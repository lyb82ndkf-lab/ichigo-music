// 一起听 发送播放状态

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.playCommand(query, request)
}
