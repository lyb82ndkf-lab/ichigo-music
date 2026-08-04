// 一起听状态

const listentogether = require('./listentogether')

module.exports = (query, request) => {
  return listentogether.statusGet(query, request)
}
