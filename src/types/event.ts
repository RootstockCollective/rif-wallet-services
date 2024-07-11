import { IApiTransactions, ITokenWithBalance, IEvent } from '../rskExplorerApi/types'

export type Event = {
  type: string
  payload: ITokenWithBalance | IApiTransactions | IEvent
}

export enum Flow {
  ALL = 'all',
  TO = 'to',
  FROM = 'from'
}
