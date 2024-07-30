export function randomNumber(min: number, max: number) {
  return ~~(Math.random() * (max - min + 1)) + min
}
export function randomFromArray(array: (string | number | boolean)[]) {
  return ~~(Math.random() * array.length)
}
export function randomString(size = 128) {
  let str = '' // String result
  for (let i = 0; i < size; i++) {
    let rand = Math.floor(Math.random() * 62) // random: 0..61
    const charCode = (rand += rand > 9 ? (rand < 36 ? 55 : 61) : 48) // Get correct charCode
    str += String.fromCharCode(charCode) // add Character to str
  }
  return str.toLocaleLowerCase() // After all loops are done, return the concatenated string
}
