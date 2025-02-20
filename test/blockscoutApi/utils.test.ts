import { changeUrlGateway } from '../../src/blockscoutApi/utils'

describe('utils', () => {
  test('convert into dedicated gateway', () => {
    const domain = 'https://gateway.pinata.cloud/ipfs'
    const urls = [
      'https://dweb.link/ipfs/QmfEnrVY7z4NJicU3FL8YepFUm9nvCcv1QuvVr9vaxsxj2',
      'https://dweb.link/ipfs/QmfDwhwpU21G9x2kzbhw1LjQGDUFLucAjcJsn8ivqTgXrm/17.png',
      'https://anothergateway.link/ipfs/QmfEnrVY7z4NJicU3FL8YepFUm9nvCcv1QuvVr9vaxsxj2',
      '',
      'ipfs://FolderCid/1.jpg']
    const expectedUrls = [
      `${domain}/ipfs/QmfEnrVY7z4NJicU3FL8YepFUm9nvCcv1QuvVr9vaxsxj2`,
      `${domain}/ipfs/QmfDwhwpU21G9x2kzbhw1LjQGDUFLucAjcJsn8ivqTgXrm/17.png`,
      `${domain}/ipfs/QmfEnrVY7z4NJicU3FL8YepFUm9nvCcv1QuvVr9vaxsxj2`,
      '',
      `${domain}/FolderCid/1.jpg`
    ]
    for (let i = 0; i < urls.length; i = i + 1) {
      expect(changeUrlGateway(urls[i])).toEqual(expectedUrls[i])
    }
  })
})
