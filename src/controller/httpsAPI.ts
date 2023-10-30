import { Application, NextFunction, Request, Response, Express } from 'express'
import { PricesQueryParams } from '../api/types'
import { registeredDapps } from '../registered_dapps'
import { errorHandler } from '../middleware'
import { LastPrice } from '../service/price/lastPrice'
import { BitcoinDatasource, RSKDatasource, RSKNodeProvider } from '../repository/DataSource'
import swaggerUI from 'swagger-ui-express'
import OpenApi from '../api/openapi'
import BitcoinRouter from '../service/bitcoin/BitcoinRouter'
import { fromApiToRtbcBalance } from '../rskExplorerApi/utils'
import { isMyTransaction } from '../service/transaction/utils'
import { IApiTransactions, IEvent, IInternalTransaction } from '../rskExplorerApi/types'
import { ValidationError, object, string } from 'yup'
import { utils } from 'ethers'

export class HttpsAPI {
  private app: Application
  private dataSourceMapping: RSKDatasource
  private lastPrice: LastPrice
  private bitcoinMapping: BitcoinDatasource
  private providerMapping: RSKNodeProvider
  constructor (app: Express, dataSourceMapping: RSKDatasource, lastPrice: LastPrice,
    bitcoinMapping: BitcoinDatasource, providerMapping: RSKNodeProvider) {
    this.app = app
    this.dataSourceMapping = dataSourceMapping
    this.lastPrice = lastPrice
    this.bitcoinMapping = bitcoinMapping
    this.providerMapping = providerMapping
  }

  responseJsonOk (res: Response) {
    return res.status(200).json.bind(res)
  }

  handleValidationError (e, res: Response) : void {
    if (e instanceof ValidationError) {
      res.status(400).json({ errors: e.errors })
    } else {
      throw e
    }
  }

  init () : void {
    const chainIdSchema = object({
      chainId: string().optional()
        .trim()
        .oneOf(Object.keys(this.dataSourceMapping), 'The current chainId is not supported')
    })
    const addressSchema = object({
      address: string().required('we required a valid address')
        .trim()
        .transform(address => utils.isAddress(address.toLowerCase()) ? address : '')
    }).required()

    this.app.get('/tokens', ({ query: { chainId = '31' } }: Request, res: Response, next: NextFunction) => {
      try {
        chainIdSchema.validateSync({ chainId })
        return this
          .dataSourceMapping[chainId as string].getTokens()
          .then(this.responseJsonOk(res))
          .catch(next)
      } catch (e) {
        this.handleValidationError(e, res)
      }
    })

    this.app.get(
      '/address/:address/tokens',
      async ({ params: { address }, query: { chainId = '31' } }: Request, res: Response, next: NextFunction) => {
        try {
          chainIdSchema.validateSync({ chainId })
          addressSchema.validateSync({ address })
          const balance = await this.providerMapping[chainId as string].getBalance(address.toLowerCase())
          return Promise.all([
            this.dataSourceMapping[chainId as string].getTokensByAddress(address),
            fromApiToRtbcBalance(balance.toHexString(), parseInt(chainId as string))
          ])
            .then(balances => [...balances[0], balances[1]])
            .then(this.responseJsonOk(res))
            .catch(next)
        } catch (e) {
          this.handleValidationError(e, res)
        }
      }
    )

    this.app.get(
      '/address/:address/events',
      ({ params: { address }, query: { chainId = '31' } }: Request, res: Response, next: NextFunction) => {
        try {
          chainIdSchema.validateSync({ chainId })
          addressSchema.validateSync({ address })
          return this
            .dataSourceMapping[chainId as string].getEventsByAddress(address)
            .then(this.responseJsonOk(res))
            .catch(next)
        } catch (e) {
          this.handleValidationError(e, res)
        }
      }
    )

    this.app.get(
      '/address/:address/transactions',
      async ({ params: { address }, query: { limit, prev, next, chainId = '31', blockNumber = '0' } }: Request,
        res: Response, nextFunction: NextFunction) => {
        try {
          chainIdSchema.validateSync({ chainId })
          addressSchema.validateSync({ address })
          const dataSource = this.dataSourceMapping[chainId as string]
          /* A transaction has the following structure { to: string, from: string }
          * and to or from params should be our address when we send or receive a cryptocurrency
          * (such as RBTC).
          */
          const transactions: {data: IApiTransactions[], prev: string, next: string} =
          await dataSource.getTransactionsByAddress(address, limit as string,
            prev as string, next as string, blockNumber as string)
            .catch(nextFunction)
          /* We query events to find transactions when we send or receive a token(ERC20)
          * such as RIF,RDOC
          * Additionally, we query internal transactions because we could send or receive a cryptocurrency
          * invoking a smart contract.
          * Finally, we filter by blocknumber and duplicates
          */
          const hashes: string[] = await Promise.all([dataSource.getEventsByAddress(address, limit as string),
            dataSource.getInternalTransactionByAddress(address, limit as string)])
            .then((promises) =>
              promises.flat()
                .filter((value: IEvent | IInternalTransaction) =>
                  isMyTransaction(value, address) && value.blockNumber >= +blockNumber)
                .filter((value: IEvent | IInternalTransaction) => !transactions.data.map(tx => tx.hash)
                  .includes(value.transactionHash))
                .map((value: IEvent | IInternalTransaction) => value.transactionHash)
            )
            .then((hashes: string[]) => Array.from(new Set(hashes)))
            .catch(() => [])
          const result = await Promise.all(
            hashes.map((hash: string) => dataSource.getTransaction(hash))
          )
          return Promise.resolve({
            prev: transactions.prev,
            next: transactions.next,
            data: [...transactions.data, ...result]
          })
            .then(this.responseJsonOk(res))
            .catch(nextFunction)
        } catch (e) {
          this.handleValidationError(e, res)
        }
      }

    )

    this.app.get(
      '/price',
      (req: Request<{}, {}, {}, PricesQueryParams>, res: Response, next: NextFunction) => {
        const addresses = req.query.addresses.split(',')
        this.lastPrice.getPrices(addresses, req.query.convert)
          .then(this.responseJsonOk(res))
          .catch(next)
      }
    )

    this.app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(OpenApi))
    this.app.use('/bitcoin', BitcoinRouter(this.responseJsonOk, this.bitcoinMapping))
    this.app.get('/dapps', (_: Request, res: Response) => this.responseJsonOk(res)(registeredDapps))

    this.app.use(errorHandler)
  }
}
