import { addressSchema, currencySchema, generateChainIdSchema, topicSchema } from '../../../src/util/schema'

describe('Schema validation', () => {
  const validAddress = '0xB1A39B8f57A55d1429324EEb1564122806eb297F'
  const addressTestData = [
    { address: validAddress, expected: true },
    { address: '  0xB1A39B8f57A55d1429324EEb1564122806eb297F ', expected: true },
    { address: '0x123', expected: false },
    { address: '', expected: false },
    { address: undefined, expected: false }
  ]
  test.each(addressTestData)(
    'should validate addresses: %p',
    ({ address, expected }) => {
      if (expected) {
        expect(addressSchema.validateSync({ address })).toStrictEqual({ address: validAddress })
      } else {
        expect(() => addressSchema.validateSync({ address })).toThrow('An address is invalid')
      }
    }
  )

  const chainIdTestData = [
    { data: { chainId: '31' }, expected: { chainId: '31' }, error: '' },
    { data: { chainId: '30' }, expected: { chainId: '30' }, error: '' },
    { data: { chainId: '30 ' }, expected: { chainId: '30' }, error: '' },
    { data: { chainId: '32' }, expected: false, error: 'The current chainId is not supported' }
  ]
  const chainIdSchema = generateChainIdSchema(['30', '31'])

  test.each(chainIdTestData)(
    'should validate chainIds: %p',
    ({ data, expected, error }) => {
      if (!error) {
        expect(chainIdSchema.validateSync(data)).toStrictEqual(expected)
      } else {
        expect(() => chainIdSchema.validateSync(data)).toThrow(error)
      }
    }
  )

  const currencyTestData = [
    { data: { convert: 'USD' }, expected: { convert: 'USD' }, error: '' },
    { data: { convert: 'EUR' }, expected: {}, error: 'The current currency is not supported' },
    { data: { convert: 'ARG' }, expected: {}, error: 'The current currency is not supported' },
    { data: { convert: '' }, expected: {}, error: 'The current currency is not supported' },
    { data: {}, expected: {}, error: '' }
  ]

  test.each(currencyTestData)(
    'should validate currency: %p',
    ({ data, expected, error }) => {
      if (!error) {
        expect(currencySchema.validateSync(data)).toStrictEqual(expected)
      } else {
        expect(() => currencySchema.validateSync(data)).toThrow(error)
      }
    }
  )

  const validTopic = '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0'

  const topicTestData = [
    { data: { topic0: '0x123' }, expected: {}, error: 'The topic0 must be 66 characters long' },
    { data: { topic0: '123' }, expected: {}, error: 'The topic0 must start with "0x"' },
    { data: { }, expected: {}, error: 'The topic0 is required' },
    { data: { topic0: validTopic, topic1: '0x123' }, expected: {}, error: 'The topic1 must be 66 characters long' },
    { data: { topic0: validTopic, topic1: '123' }, expected: {}, error: 'The topic1 must start with "0x"' },
    { data: { topic0: validTopic, topic1: '' }, expected: {}, error: 'The topic1 must start with "0x"' },
    {
      data: { topic0: validTopic, topic1: validTopic },
      expected: { topic0: validTopic, topic1: validTopic },
      error: ''
    }
  ]

  test.each(topicTestData)(
    'should validate topics: %p',
    ({ data, expected, error }) => {
      if (!error) {
        expect(topicSchema.validateSync(data)).toStrictEqual(expected)
      } else {
        expect(() => topicSchema.validateSync(data)).toThrow(error)
      }
    }
  )
})
