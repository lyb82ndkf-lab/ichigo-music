// Fetch a slice of playlist tracks without exceeding the upstream song-detail
// request limit. The client may ask for more than 1000 songs; split that work
// into bounded batches while keeping the legacy response shape.

const createOption = require('../util/option.js')

module.exports = (query, request) => {
  const data = {
    id: query.id,
    n: 100000,
    s: query.s || 8,
  }
  const limit = Math.max(0, parseInt(query.limit, 10) || 2000)
  const offset = Math.max(0, parseInt(query.offset, 10) || 0)
  const batchSize = 500

  return request(`/api/v6/playlist/detail`, data, createOption(query)).then(
    async (res) => {
      const trackIds = res.body.playlist.trackIds || []
      const selected = trackIds.slice(offset, offset + limit)
      const songs = []

      // Keep batches serial to avoid oversized request bodies and upstream
      // throttling when opening a large favourite list.
      for (let start = 0; start < selected.length; start += batchSize) {
        const batch = selected.slice(start, start + batchSize)
        if (batch.length === 0) continue
        const idsData = {
          c: '[' + batch.map((item) => '{"id":' + item.id + '}').join(',') + ']',
        }
        const detailRes = await request(`/api/v3/song/detail`, idsData, createOption(query))
        songs.push(...(detailRes.body.songs || []))
      }

      res.body.playlist.tracks = songs
      res.body.songs = songs
      return res
    },
  )
}
