
export type HTTPRequestOptions = {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  headers?: { [index: string]: string }
  body?: any
}
export type HTTPResponse = {
  error: boolean
  message?: string
}

export type LngLat = [number, number]
export type GPSLocation = {
  lng: number
  lat: number
  heading?: number
}
export type LivePosition = {
  id: string,
  position: Vehicle
}

export type Waypoint = {
  no: number
  type: 'pickup' | 'dropoff'
  description: string
  coordinates: LngLat
  address?: string
  contact: {
    type: string
    reference: string
    phone?: string
    email?: string
  }
}
export type WaypointIndex = 'origin' | 'destination' | number
export type WaypointOptions = {
  no?: number
  type?: 'pickup' | 'dropoff'
  description?: string
  coordinates?: LngLat
  address?: string
  'contact.type'?: string
  'contact.reference'?: string
  'contact.phone'?: string
  'contact.email'?: string
}

export type Package = {
  waypointNo: number
  careLevel: number
  category: string
  weight: number
  note?: string
}
export type PackageOptions = {
  waypointNo?: number
  careLevel?: number
  category?: string
  weight?: number
  note?: string
}

export type PaymentMode = 'cash' | 'card' | 'momo' | 'wigo'
export type OrderService = {
  fees: {
    total: {
      amount: number
      currency: string
    },
    tax: number
    discount: number
  }
  payment: {
    mode: PaymentMode
    paid: boolean
  }
  xpress: string
}
export type OrderServiceOptions = {
  'fees.total.amount'?: number
  'fees.total.currency'?: string
  'fees.tax'?: string
  'fees.discount'?: string
  'payment.mode'?: PaymentMode
  'payment.option'?: string
  'payment.paid'?: boolean
  xpress?: string
}
export type OrderOperator = {}
export type OrderStage = {
  current: string
  status: string
}

export type Message = {
  type: 'text' | 'location' | 'media'
  sender: string
  content: string
  timestamp: string
}
export type Caption = {
	duration?: number
	unit?: string
	label?: string
}
export type Peer = {
  utype: string
  id: string
}

export type MapOptions = {
  element: string
  accessToken: string
  version?: number
  env?: 'dev' | 'prod'
}
export type MapLayerStyle = 'streets' | 'outdoors' | 'light' | 'dark' | 'satellite'
export type MapWaypoint = {
  index?: number
  lngLat: LngLat
  caption?: Caption
}

export type Entity = {
  id: string
  status: 'ACTIVE' | 'BUSY'
  level: '1H' | '2H' | '3H'
  location: GPSLocation
  static?: boolean
  type: 'moto' | 'car' | 'bike' | 'truck' | 'plane' | 'ship' | 'restaurant' | 'hotel' | 'store' | 'office' | 'warehouse'
}