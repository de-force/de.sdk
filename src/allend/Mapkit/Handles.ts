import type { Coordinates, GPSLocation, Entity, MapOptions, Caption, Itinerary, LivePosition } from '../../types'

import IOF from 'iframe.io'
import { EventEmitter } from 'events'
import Controls from './Controls'
import Stream from '../../utils/stream'

export interface ControlEntity {
  add: ( entity: Entity, callback?: () => void ) => void
  remove: ( id: string, callback?: () => void ) => void
  move: ( update: LivePosition, callback?: () => void ) => void
}
export type LRSControlsListener = ( controls: ControlEntity ) => void
export type LRSErrorListener = ( error?: Error | boolean ) => void

export default class Handles extends EventEmitter {
  private chn: IOF
  private controls: Controls
  private options: MapOptions

  constructor( chn: IOF, controls: Controls, options: MapOptions ){
    super()

    this.chn = chn
    this.options = options
    this.controls = controls
  }

  /**
   * Create new stream through which user's current location
   * details will be pushed to the API level.
   * 
   * @param usertype - (Default: `client`) Type of user at the current location
   * @return - Readable stream
   */
  myLocation( usertype?: 'client' | 'agent' ){
    if( !this.chn ) return
    this.chn?.emit('pin:current:location', usertype || 'client' )

    const stream = new Stream()

    this.chn
    .on('current:location', ( location: GPSLocation  ) => stream.sync( location ) )
    .on('live:location:start', ( location: GPSLocation  ) => stream.sync( location ) )
    .on('live:location:update', ( location: GPSLocation  ) => stream.sync( location ) )
    .on('live:location:end', ( location: GPSLocation  ) => stream.sync( location ) )
    .on('current:location:error', ( message: string ) => stream.error( new Error( message ) ) )

    // Listen to stream closed
    stream
    .onerror( error => console.error('[Stream Error] ', error ) )
    .onclose( () => {
      if( !this.chn ) return

      this.chn
      .off('current:location')
      .off('current:location:live')
      .off('current:location:error')
    } )

    return stream
  }

  /**
   * Create new stream through which the current location details
   * of user's peer (Eg. `agent`) will be pushed to the API level.
   * 
   * @param position - Peer's current GPS location
   * @param caption - (Optional) Caption information of the peer
   * @return - Readable stream
   */
  peerLocation( position: GPSLocation , caption?: Caption ){
    if( !this.chn ) return
    this.chn?.emit('pin:peer:location', { id: 'peer', position, caption } )
    
    const stream = new Stream
    
    // Listen to incoming new position data
    stream
    .on('data', ({ position, caption }: any ) => {
      if( !position )
        return stream.error( new Error('Invalid Data') )

      this.chn?.emit('pin:peer:location', { id: 'peer', position, caption } )
    })
    .onerror( error => console.error('[Stream Error] ', error ) )
    .onclose( () => this.chn?.emit('unpin:peer:location', 'peer') )

    return stream
  }

  /**
   * Open a live stream through which the current location details
   * and profile information of all periferals entities around 
   * this user (Eg. `bike`, `car`, ...) will be pushed to the 
   * API level.
   * 
   * @param list - List of detected periferals entities around this user.
   * @return - Live Readable Stream (LRS)
   */
  periferals( list: Entity[] ){
    if( !this.chn ) return

    const self = this
    let _CLOSED = false
    
    this.chn?.emit('show:periferals', list )
    
    const
    stream = new Stream,
    controls: ControlEntity = {
      /**
       * Add new entity to the periferals list
       * 
       * @param entity - GPS location and profile of the entity
       */
      add( entity ): Promise<void> {
        return new Promise( ( resolve, reject ) => {
          if( _CLOSED ) return

          // Maintain initial list of periferals: Prevent duplicated entity
          for( let x = 0; x < list.length; x++ )
            if( list[x].id === entity.id ){
              list.splice( x, 1 )
              self.chn?.emit('remove:periferal:entity', entity.id )
              break
            }
          
          // Track response timeout
          let TIMEOUT: any
          
          // Add new entity
          list.push( entity )
          self.chn?.emit('add:periferal:entity', entity, () => {
            clearTimeout( TIMEOUT )
            resolve()

            self.emit('periferals--stream', 'add', entity )
          } )

          setTimeout( () => reject('Add entity timeout'), 8000 )
        })
      },

      /**
       * Remove an entity (vehicle, premises) from the periferals list
       * 
       * @param id - ID of targeted entity
       */
      remove( id ): Promise<void> {
        return new Promise( ( resolve, reject ) => {
          if( _CLOSED ) return
          
          // Track response timeout
          let TIMEOUT: any

          list = list.filter( each => { return each.id !== id } )
          self.chn?.emit('remove:periferal:entity', id, () => {
            clearTimeout( TIMEOUT )
            resolve()

            self.emit('periferals--stream', 'remove', id )
          } )

          setTimeout( () => reject('Remove entity timeout'), 8000 )
        } )
      },
      
      /**
       * Change mobile entities position on the map
       * 
       * @param location - New GPS location of the entity
       */
      move( location ): Promise<void> {
        return new Promise( ( resolve, reject ) => {
          if( _CLOSED ) return
          
          // Track response timeout
          let TIMEOUT: any
          
          self.chn?.emit('move:periferal:entity', location, () => {
            clearTimeout( TIMEOUT )
            resolve()

            self.emit('periferals--stream', 'move', location )
          } )

          setTimeout( () => reject('Remove entity timeout'), 8000 )
        } )
      }
    }

    const
    /**
     * 
     */
    live = ( fn: LRSControlsListener ) => {
      fn( controls )
      return stream
    },
    close = ( fn?: LRSErrorListener ) => {
      if( _CLOSED ) return

      this.chn?.emit('remove:periferals', ( error: string | boolean ) => {
        if( typeof error == 'string' ) 
          return typeof fn == 'function' && fn( new Error( error ) )

        _CLOSED = true
        stream.isActive() && stream.close()

        typeof fn == 'function' && fn()
      })
    }
    
    this.on('periferals--stream', ( action, dataset ) => stream.sync({ action, dataset, list }) )
    // Listen to stream closed
    stream
    .onerror( error => console.error('[Stream Error] ', error ) )
    .onclose( ( fn?: () => void ) => {
      this.off('periferals--stream', fn || (() => {}) )
      close()
    })
    
    return { live, pipe: stream.pipe, close }
  }

  /**
   * Set service pickup point.
   * 
   * @param location - Location coordinates
   * @param caption - (Optional) Caption information of the pickup point
   */
  async pickupPoint( location: Coordinates, caption?: Caption ): Promise<void> {
    // Default pickup caption
    const _caption: Caption = { 
      label: 'Pickup point',
      ...(caption || {})
    }
    
    await this.controls?.setOrigin( location, _caption )
  }

  /**
   * Set service dropoff point.
   * 
   * @param location - Location coordinates
   * @param caption - (Optional) Caption information of the pickup point
   */
  async dropoffPoint( location: Coordinates, caption?: Caption ): Promise<void> {
    // Default destination caption
    const _caption: Caption = {
      label: 'Destination point',
      ...(caption || {})
    }
    
    await this.controls?.setDestination( location, _caption )
  }

  /**
   * Create new stream through which navigation details of
   * this user's peer will be display on the user's map also
   * pushed to the API level.
   * 
   * @return - Readable stream
   */
  peerDirection(){
    if( !this.chn ) return
    const stream = new Stream

    stream
    .on('data', ({ status, direction, position }: any ) => {
      if( !direction || !position )
        return stream.error( new Error('Invalid Data') )
        
      this.controls?.upsertDirection({ direction, position })

      switch( status ){
        case 'STALE':
        case 'STARTED':
        case 'LONG_STOP':
        case 'LOW_TRAFFIC':
        case 'HIGH_TRAFFIC':
        case 'MODERATE_TRAFFIC':
        case 'SPEED_WARNING':
        case 'NEARBY':
        case 'ARRIVED': this.emit(`pe:${status.toLowerCase()}`); break
        case 'UNAVAILABLE': {
          this.emit(`pe:closed`)
          stream.isActive() && stream.close()
        } break
      }
    })
    .onerror( error => console.error('[Stream Error] ', error ) )

    return stream
  }

  /**
   * Initiate user (Eg. agent) live navigation on the map 
   * and create a new stream through which the navigation details 
   * will be pushed to the API level.
   * 
   * @param itinerary - Route origin, waypoints, destination
   * @return - Readable stream
   */
  navigation( itinerary: Itinerary ){
    return new Promise( ( resolve, reject ) => {
      if( !this.chn ) return

      const initialize = () => {
        const stream = new Stream

        // Sync with navigation route update
        this.chn?.on('navigation:direction', ({ status, direction, position }) => {
          stream.sync({ status, direction, position })

          switch( status ){
            case 'STALE':
            case 'STARTED':
            case 'LONG_STOP':
            case 'LOW_TRAFFIC':
            case 'HIGH_TRAFFIC':
            case 'MODERATE_TRAFFIC':
            case 'SPEED_WARNING':
            case 'NEARBY':
            case 'ARRIVED': this.emit(`pe:${status.toLowerCase()}`); break
            case 'UNAVAILABLE': {
              this.emit(`pe:closed`)
              stream.isActive() && stream.close()
            } break
          }
        })

        stream
        // Listen location/position update
        .on('data', ({ position }: any ) => {
          if( !position )
            return stream.error( new Error('Invalid Data') )
          
          this.controls?.navigate( position )
        })
        .onerror( error => console.error('[Stream Error] ', error ) )
        .onclose( () => {
          this.chn?.off('navigation:direction')
          this.controls?.stopNavigation()
        })

        resolve( stream )
      }
      
      // Set route
      this.controls?.setRoute( itinerary )
                    .then( async () => {
                      // Initialize navigation point to current location
                      const position = itinerary.origin?.coords || await this.controls?.getCurrentLocation()
                      if( !position ) return reject('Unable to get current location')

                      initialize()

                      await this.controls?.startNavigation()
                      await this.controls?.setInitialPosition( position )
                    } )
                    .catch( reject )
    } )
  }
}