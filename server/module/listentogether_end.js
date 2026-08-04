// 一起听 结束房间

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.end(query, request)
}
