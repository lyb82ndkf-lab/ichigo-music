// 一起听创建房间

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.roomCreate(query, request)
}
