// 一起听 更新播放列表

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.syncListCommand(query, request)
}
