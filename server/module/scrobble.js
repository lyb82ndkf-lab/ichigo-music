const createOption = require('../util/option.js')
const { APP_CONF } = require('../util/config.json')

const DOMAIN = APP_CONF.clDomian

/**
 * Submit the two feedback records used by the web/desktop clients.
 *
 * `startplay` updates the account's recent-play list while `play` updates the
 * listening statistics.  Keep these requests separate: the upstream API can
 * accept one while rejecting the other, and returning both responses makes it
 * possible for the renderer to retry or diagnose the failure.
 */
module.exports = async (query, request) => {
  let cookie = query.cookie || ''
  if (typeof cookie === 'object') {
    cookie = Object.assign({ os: 'osx' }, cookie)
  } else if (typeof cookie === 'string') {
    cookie = cookie.includes('os=')
      ? cookie.replace(/os=[^;]+/g, 'os=osx')
      : `${cookie}; os=osx`
  } else {
    cookie = 'os=osx'
  }
  query.cookie = cookie

  const startplayData = {
    logs: JSON.stringify([{
      action: 'startplay',
      json: {
        id: query.id,
        type: 'song',
        mainsite: '1',
        mainsiteWeb: '1',
        content: `id=${query.sourceid || query.id}`,
      },
    }]),
  }

  const playData = {
    logs: JSON.stringify([{
      action: 'play',
      json: {
        download: 0,
        end: 'playend',
        id: query.id,
        sourceId: query.sourceid || query.id,
        time: query.time,
        type: 'song',
        wifi: 0,
        source: 'list',
        mainsite: '1',
        mainsiteWeb: '1',
        content: `id=${query.sourceid || query.id}`,
      },
    }]),
  }

  const option = createOption(query, 'eapi')
  option.domain = DOMAIN

  const startplayResponse = await request('/api/feedback/weblog', startplayData, option)
  const playResponse = await request('/api/feedback/weblog', playData, option)

  return {
    status: 200,
    body: {
      code: 200,
      data: 'success',
      details: {
        startplay: startplayResponse?.body,
        play: playResponse?.body,
      },
    },
  }
}
