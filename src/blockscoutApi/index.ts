import _axios from 'axios'
import { DataSource } from '../repository/DataSource'
import {
  BalanceServerResponse, InternalTransactionResponse, NFTInstanceResponse,
  ServerResponse, ServerResponseV2, TokenBalanceServerResponse,
  TokenInfoResponse,
  TokenServerResponse, TokenTransferApi, TransactionServerResponse,
  TransactionsServerResponse, BlockscoutTransactionResponseTxResult,
  NftTokenHoldersResponse, TokenHoldersResponse
} from './types'
import {
  fromApiToInternalTransaction, fromApiToNft, fromApiToNftOwner, fromApiToRtbcBalance, fromApiToTEvents,
  fromApiToTokenWithBalance, fromApiToTokens, fromApiToTransaction, transformResponseToNftHolder
} from './utils'
import {
  GetEventLogsByAddressAndTopic0, GetNftHoldersData,
  GetTokenHoldersByAddress
} from '../service/address/AddressService'
import { AxiosCacheInstance, setupCache } from 'axios-cache-interceptor'

export class BlockscoutAPI extends DataSource {
  private chainId: number
  private axiosCache: AxiosCacheInstance
  private errorHandling = (e) => {
    console.error(e)
    return []
  }

  constructor (apiURL: string, chainId: number, axios: typeof _axios, id: string) {
    super(apiURL, id, axios)
    this.chainId = chainId
    this.axiosCache = setupCache(_axios.create(), {
      ttl: 1000 * 60,
      interpretHeader: false
    })
  }

  getTokens () {
    return this.axios?.get<TokenServerResponse>(`${this.url}/v2/tokens`)
      .then(response => response.data.items
        .map(token => fromApiToTokens(token, this.chainId)))
      .catch(this.errorHandling)
  }

  async getTokensByAddress (address: string) {
    return this.axios?.get<TokenBalanceServerResponse[]>(
      `${this.url}/v2/addresses/${address.toLowerCase()}/token-balances`
    )
      .then(response => response.data.filter(t => t.token.name != null)
        .map(token => {
          token.token.value = token.value
          return fromApiToTokenWithBalance(token.token, this.chainId)
        }))
      .catch(this.errorHandling)
  }

  getRbtcBalanceByAddress (address: string) {
    return this.axios?.get<BalanceServerResponse>(`${this.url}/v2/addresses/${address.toLowerCase()}`)
      .then(response => fromApiToRtbcBalance(response.data.coin_balance, this.chainId))
      .catch(this.errorHandling)
  }

  async getEventsByAddress (address: string) {
    const params = {
      module: 'account',
      action: 'tokentx',
      address: address.toLowerCase()
    }
    return this.axios?.get<ServerResponse<TokenTransferApi>>(`${this.url}`, { params })
      .then(response =>
        response.data.result
          .map(tokenTranfer => {
            return fromApiToTEvents(tokenTranfer)
          }))
      .catch(this.errorHandling)
  }

  getTransaction (hash: string) {
    return this.axios?.get<TransactionServerResponse>(`${this.url}/v2/transactions/${hash}`)
      .then(response =>
        fromApiToTransaction(response.data))
      .catch(this.errorHandling)
  }

  getInternalTransactionByAddress (address: string) {
    return this.axios?.get<InternalTransactionResponse>(
      `${this.url}/v2/addresses/${address.toLowerCase()}/internal-transactions`
    )
      .then(response => response.data.items.map(fromApiToInternalTransaction))
      .catch(this.errorHandling)
  }

  getTransactionsByAddress (address: string) {
    return this.axios?.get<TransactionsServerResponse>(
      `${this.url}/v2/addresses/${address.toLowerCase()}/transactions`
    )
      .then(response => ({ data: response.data.items.map(fromApiToTransaction) }))
      .catch(e => {
        console.error(e)
        return { data: [] }
      })
  }

  getNft (address: string) {
    return this.axios?.get<TokenInfoResponse>(`${this.url}/v2/tokens/${address.toLowerCase()}`)
      .then(response => (fromApiToNft(response.data)))
      .catch(this.errorHandling)
  }

  async getNftOwnedByAddress (address: string, nft: string) {
    const limit = 10
    let counter = 0
    let items:NFTInstanceResponse[] = []
    const url = `${this.url}/v2/tokens/${nft.toLowerCase()}/instances`
    let response = await this.axios?.get<ServerResponseV2<NFTInstanceResponse>>(url)
      .then(e => {
        items = e.data.items
        return e.data
      })
      .catch(() => ({ items: [], next_page_params: null }))
    if (response && !response.next_page_params) {
      return fromApiToNftOwner(address, response.items)
    }
    while (response && response.next_page_params && counter < limit) {
      counter++
      response = await this.axios?.get<ServerResponseV2<NFTInstanceResponse>>(url,
        { params: response.next_page_params })
        .then(n => {
          items = [...items, ...(n.data.items)]
          return n.data
        }).catch(() => ({ items: [], next_page_params: null }))
    }
    return fromApiToNftOwner(address, [...(response?.items || []), ...items])
  }

  async getEventLogsByAddressAndTopic0 ({
    address, topic0, toBlock = 'latest', fromBlock, topic1, topic01Opr
  }: Omit<GetEventLogsByAddressAndTopic0, 'chainId'>) {
    let fromBlockToUse = fromBlock

    if (!fromBlock) {
      try {
        const params = {
          module: 'account',
          action: 'txlist',
          address,
          sort: 'asc'
        }
        const response = await this.axiosCache.get<ServerResponse<BlockscoutTransactionResponseTxResult>>(
          this.url, {
            params,
            cache: {
              ttl: 1000 * 60 * 15
            }
          }
        )

        if (!response?.data) {
          throw new Error('No response from Blockscout.')
        }

        const { result } = response.data

        if (result?.length > 0) {
          const firstTx = result[0]
          fromBlockToUse = firstTx.blockNumber?.toString()
        } else {
          throw new Error('Blockscout returned no transactions for the given address.')
        }
      } catch (error) {
        // An error happened, log it
        console.error(`Failed to query Blockscout: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (!fromBlockToUse) return []
    let params = {
      module: 'logs',
      action: 'getLogs',
      address: address.toLowerCase(),
      toBlock,
      fromBlock: fromBlockToUse,
      topic0
    }
    if (topic1 && topic01Opr) {
      params = { ...params, ...{ topic1, topic0_1_opr: topic01Opr } }
    }
    return this.axiosCache.get<ServerResponse<TokenTransferApi>>(`${this.url}`, { params })
      .then(({ data }) => data.result)
      .catch(() => [])
  }

  async getTokenHoldersByAddress ({ address, nextPageParams }: GetTokenHoldersByAddress) {
    try {
      const url = `${this.url}/v2/tokens/${address}/holders`
      const response = await this.axiosCache.get<ServerResponseV2<TokenHoldersResponse>>(url,
        { params: nextPageParams, validateStatus: (status) => status <= 500 })
      if (response?.status === 200) {
        return response.data
      }
      return {
        items: [],
        next_page_params: null,
        error: `Blockscout error with status ${response?.status}`
      }
    } catch (error) {
      console.error(typeof error, error)
      return {
        items: [],
        next_page_params: null,
        error: 'Blockscout error'
      }
    }
  }

  async getNftInstancesByAddress ({ address, nextPageParams }: GetNftHoldersData) {
    const url = `${this.url}/v2/tokens/${address.toLowerCase()}/instances`
    try {
      const response = await this.axiosCache.get<ServerResponseV2<NftTokenHoldersResponse>>(url, {
        params: nextPageParams,
        validateStatus: (status) => status <= 500
      })

      if (response?.status === 200) {
        const nftHolders = transformResponseToNftHolder(response.data.items)
        return {
          // Reverse the array to show the holders starting from the first
          items: nftHolders.reverse(),
          next_page_params: response.data.next_page_params
        }
      }
      return {
        items: [],
        next_page_params: null,
        error: `Blockscout error with status ${response?.status}`
      }
    } catch (error) {
      console.error(typeof error, error)
      throw new Error(`Failed to get NFT holders data: ${error instanceof Error ? error.message : String(error)}`)
    };
  }
}
