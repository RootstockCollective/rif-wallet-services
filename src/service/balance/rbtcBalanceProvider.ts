import { ethers } from 'ethers'
import { DataSource } from '../../repository/DataSource'
import { fromApiToRtbcBalance } from '../../rskExplorerApi/utils'
import type { Event } from '../../types/event'
import { PollingProvider } from '../AbstractPollingProvider'

export class RbtcBalanceProvider extends PollingProvider<Event> {
  private dataSource: DataSource
  private provider: ethers.JsonRpcProvider

  constructor (address: string, dataSource: DataSource, provider: ethers.JsonRpcProvider) {
    super(address)
    this.dataSource = dataSource
    this.provider = provider
  }

  async poll () {
    return await this.provider.getBalance(this.address.toLowerCase())
      .then(balance => fromApiToRtbcBalance(balance.toString(16), parseInt(this.dataSource.id)))
      .then(rbtcBalance => [{ type: 'newBalance', payload: rbtcBalance }])
      .catch(() => [])
  }

  public async getCurrentBalance () {
    return await this.provider.getBalance(this.address.toLowerCase())
      .then(balance => fromApiToRtbcBalance(balance.toString(16), parseInt(this.dataSource.id)))
      .catch(() => fromApiToRtbcBalance('0', parseInt(this.dataSource.id)))
  }
}
