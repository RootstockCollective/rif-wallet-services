import { object, string } from 'yup'
import { isAddress } from 'ethers'
import { supportedFiat } from '../../coinmarketcap/support'

export const generateChainIdSchema = (keys: string[]) => object({
  chainId: string()
    .test('is-string', 'chainId must be a string', (value) => typeof value === 'string')
    .transform(value => typeof value === 'string' ? value.trim() : value)
    .oneOf(keys, 'The current chainId is not supported')
})

export const addressSchema = object({
  address: string().required('An address is invalid')
    .trim()
    .transform(address => isAddress(address.toLowerCase()) ? address : '')
}).required()

export const currencySchema = object({
  convert: string().optional()
    .trim()
    .oneOf(supportedFiat, 'The current currency is not supported')
})

export const topicSchema = object({
  topic0: string().required('The topic0 is required')
    .trim()
    .matches(/^0x/, 'The topic0 must start with "0x"')
    .length(66, 'The topic0 must be 66 characters long'),
  topic1: string()
    .matches(/^0x/, 'The topic1 must start with "0x"')
    .length(66, 'The topic1 must be 66 characters long')
    .nullable()
    .notRequired(),
  topic01Opr: string()
    .oneOf(['and', 'or'], 'The topic01Opr must be either "and" or "or"')
    .nullable()
    .notRequired()
})
