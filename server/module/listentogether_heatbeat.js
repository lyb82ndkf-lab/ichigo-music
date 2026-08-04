// 一起听 发送心跳

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.heartbeat(query, request)
}
