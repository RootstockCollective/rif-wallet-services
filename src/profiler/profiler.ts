import { Emitter } from './Emitter'
import { BalanceProfiler } from './BalanceProfiler'
import { PriceProfiler } from './PriceProfiler'
import { TransactionProfiler } from './TransactionProfiler'
import { LastPrice } from '../service/price/lastPrice'
import { TokenTransferProfiler } from './TokenTransferProfiler'
import { RbtcBalanceProfiler } from './RbtcBalanceProfiler'
import { DataSource } from '../repository/DataSource'
import { ethers } from 'ethers'

export class Profiler extends Emitter {
  balanceProfiler: BalanceProfiler
  rbtBalanceProfiler: RbtcBalanceProfiler
  transactionProfiler: TransactionProfiler
  priceProfiler: PriceProfiler
  address: string
  tokenTransferProfiler: TokenTransferProfiler

  constructor (address: string, dataSource: DataSource,
    lastPrice: LastPrice, provider: ethers.JsonRpcProvider) {
    super()
    this.address = address

    this.balanceProfiler = new BalanceProfiler(address, dataSource)
    this.rbtBalanceProfiler = new RbtcBalanceProfiler(address, dataSource, provider)

    this.transactionProfiler = new TransactionProfiler(address, dataSource)
    this.tokenTransferProfiler = new TokenTransferProfiler(address, dataSource)

    const priceChannel = 'prices'
    this.priceProfiler = new PriceProfiler(lastPrice, priceChannel)
  }

  async subscribe () {
    this.priceProfiler.on(this.priceProfiler.channel, (newPrices) => {
      this.emit(this.priceProfiler.channel, newPrices)
    })
    this.priceProfiler.subscribe()

    const balanceChannel = 'balances'
    this.balanceProfiler.on(balanceChannel, (newBalance) => {
      this.emit(balanceChannel, newBalance)
    })
    await this.balanceProfiler.subscribe(balanceChannel)

    const transactionChannel = 'transactions'
    this.transactionProfiler.on(transactionChannel, (newTransaction) => {
      this.emit(transactionChannel, newTransaction)
    })
    await this.transactionProfiler.subscribe(transactionChannel)

    const rbtcBalanceChannel = 'rbtcBalance'
    this.rbtBalanceProfiler.on(balanceChannel, (newBalance) => {
      this.emit(rbtcBalanceChannel, newBalance)
    })
    await this.rbtBalanceProfiler.subscribe(balanceChannel)
  }

  unsubscribe (): void {
    this.balanceProfiler.unsubscribe()
    this.rbtBalanceProfiler.unsubscribe()
    this.transactionProfiler.unsubscribe()
    this.priceProfiler.unsubscribe()
    this.tokenTransferProfiler.unsubscribe()
  }
}
