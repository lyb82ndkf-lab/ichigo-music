// 一起听 当前列表获取

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.syncPlaylistGet(query, request)
}
