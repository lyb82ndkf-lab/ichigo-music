// 一起听 房间情况

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.roomCheck(query, request)
}
