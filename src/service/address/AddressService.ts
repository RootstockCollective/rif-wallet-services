import { RSKDatasource, RSKNodeProvider } from '../../repository/DataSource'
import { isMyTransaction } from '../transaction/utils'
import { IApiTransactions, IEvent, IInternalTransaction } from '../../rskExplorerApi/types'
import { LastPrice } from '../price/lastPrice'
import { fromApiToRtbcBalance } from '../../rskExplorerApi/utils'
import { NextPageParams } from '../../blockscoutApi/types'

interface AddressServiceDependencies {
  dataSourceMapping: RSKDatasource
  lastPrice: LastPrice
  providerMapping: RSKNodeProvider
}

interface GetTransactionsByAddressFunction {
  address: string
  limit: string,
  chainId: string
  prev?: string
  next?: string
  blockNumber: string
}

interface GetPricesFunction {
  addresses: string
  convert: string
}

interface GetTokensByAddress {
  chainId: string
  address: string
}

interface GetNftsByAddress extends GetTokensByAddress {
  nftAddress: string
}

export interface GetEventLogsByAddressAndTopic0 {
  address: string
  topic0: string
  toBlock: string
  chainId: string
  fromBlock?: string
  topic1?: string
  topic01Opr?: string
}

export interface GetNftHoldersData { address: string, nextPageParams?: NextPageParams, chainId: string }
export interface GetTokenHoldersByAddress { address: string, nextPageParams?: NextPageParams, chainId: string }

type GetBalancesTransactionsPricesByAddress = {
  chainId: string
  address: string
} & GetTransactionsByAddressFunction

type InternalTransactionOrEvent = IEvent | IInternalTransaction

export class AddressService {
  private dataSourceMapping: AddressServiceDependencies['dataSourceMapping']
  private lastPrice: AddressServiceDependencies['lastPrice']
  private providerMapping: AddressServiceDependencies['providerMapping']

  constructor (dependencies: AddressServiceDependencies) {
    this.dataSourceMapping = dependencies.dataSourceMapping
    this.lastPrice = dependencies.lastPrice
    this.providerMapping = dependencies.providerMapping
  }

  async getTransactionsByAddress (
    { chainId, address, limit, next, prev, blockNumber }: GetTransactionsByAddressFunction
  ) {
    const dataSource = this.dataSourceMapping[chainId]
    /* A transaction has the following structure { to: string, from: string }
      * and to or from params should be our address when we send or receive a cryptocurrency
      * (such as RBTC).
    */
    const transactions: {data: IApiTransactions[], prev: string, next: string} =
      await dataSource.getTransactionsByAddress(address, limit, prev, next, blockNumber)

    /* We query events to find transactions when we send or receive a token(ERC20)
      * such as RIF,RDOC
      * Additionally, we query internal transactions because we could send or receive a cryptocurrency
      * invoking a smart contract.
      * Finally, we filter by blocknumber and duplicates
    */
    const hashes: string[] = await Promise.all([
      dataSource.getEventsByAddress(address, limit as string),
      dataSource.getInternalTransactionByAddress(address, limit as string)
    ])
      .then((promises) => {
        return promises.flat()
          .filter((value: InternalTransactionOrEvent) =>
            isMyTransaction(value, address) && value.blockNumber >= +blockNumber)
          .filter((value: InternalTransactionOrEvent) =>
            !transactions.data.map(tx => tx.hash).includes(value.transactionHash))
          .map((value: InternalTransactionOrEvent) => value.transactionHash)
      })
      .then(hashes => Array.from(new Set(hashes)))
      .catch(() => [])

    const result = await Promise.all(hashes.map(hash => dataSource.getTransaction(hash)))

    return {
      prev: transactions.prev,
      next: transactions.next,
      data: [...transactions.data, ...result]
    }
  }

  async getPrices ({ addresses, convert }: GetPricesFunction) {
    const addressesArr = addresses.toLowerCase().split(',')
    return this.lastPrice.getPrices(addressesArr, convert)
  }

  async getTokensByAddress ({ chainId, address }: GetTokensByAddress) {
    const balance = await this.providerMapping[chainId].getBalance(address.toLowerCase())
    const balances = await Promise.all([
      this.dataSourceMapping[chainId].getTokensByAddress(address),
      fromApiToRtbcBalance(`0x0${balance.toString(16)}`, parseInt(chainId))
    ])
    return balances.flat()
  }

  async getLatestPrices () {
    return this.lastPrice.prices
  }

  async getAddressDetails ({
    chainId,
    address,
    blockNumber,
    limit,
    prev,
    next
  }: GetBalancesTransactionsPricesByAddress) {
    const [prices, tokens, transactions] = await Promise.all([
      this.getLatestPrices(),
      this.getTokensByAddress({ chainId, address }),
      this.getTransactionsByAddress({ chainId, address, blockNumber, limit, prev, next })
    ])
    return {
      prices,
      tokens,
      transactions
    }
  }

  async getNftInfo ({ chainId, address }: GetTokensByAddress) {
    const dataSource = this.dataSourceMapping[chainId]
    return dataSource.getNft(address)
  }

  async getNftOwnedByAddress ({ chainId, address, nftAddress }: GetNftsByAddress) {
    const dataSource = this.dataSourceMapping[chainId]
    return dataSource.getNftOwnedByAddress(address, nftAddress)
  }

  async getEventLogsByAddressAndTopic0 ({ chainId, ...rest }: GetEventLogsByAddressAndTopic0) {
    const dataSource = this.dataSourceMapping[chainId]
    return dataSource.getEventLogsByAddressAndTopic0(rest)
  }

  async getNftHoldersData ({ chainId, ...rest }: GetNftHoldersData) {
    const dataSource = this.dataSourceMapping[chainId]
    return dataSource.getNftInstancesByAddress(rest)
  }

  async getTokenHoldersByAddress ({ chainId, ...rest }: GetTokenHoldersByAddress) {
    const dataSource = this.dataSourceMapping[chainId]
    return dataSource.getTokenHoldersByAddress(rest)
  }
}
