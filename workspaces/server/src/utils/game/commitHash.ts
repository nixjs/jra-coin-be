import { keccak_256 as keccak256 } from '@noble/hashes/sha3'
import { bytesToHex as toHex } from '@noble/hashes/utils'
import { randomNumber, randomString } from './randomize'

function generateCommitHash(
  result: string,
  length: number,
  pattern: string,
  commitHashSignature?: boolean,
) {
  const resultLeng = result.length
  const container = randomString(length)
  const resultPattern = pattern.replace('%s', result)
  const maxIdx = length - resultLeng
  const startIdx = randomNumber(0, maxIdx)
  const maskedResult = `${container.substring(0, startIdx)}${resultPattern}${container.substring(startIdx + resultLeng, length)}`
  const commitHash = toHex(keccak256(maskedResult))
  let signature = ''
  if (commitHashSignature) {
    // sign commit hash with privateKey
    signature = 'abc'
  }
  return { commitHash, signature, maskedResult }
}

export default generateCommitHash
