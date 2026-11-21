import { defineMethod } from '../../core'
import {
  ZotzShortNameSetParams,
  ZotzShortNamesListParams
} from '../../../../../shared/rpc-contract/zotz/zotz-short-name-params'
import { getZotzShortNameStore } from '../../../../zotz/zotz-short-name-store'

export const ZOTZ_SHORT_NAMES_LIST_METHOD = defineMethod({
  name: 'zotz.shortNames.list',
  permission: 'workspace',
  params: ZotzShortNamesListParams,
  handler: async () => ({ names: await getZotzShortNameStore().list() })
})

export const ZOTZ_SHORT_NAME_SET_METHOD = defineMethod({
  name: 'zotz.shortNames.set',
  permission: 'workspace',
  params: ZotzShortNameSetParams,
  handler: async ({ path, shortName }) => getZotzShortNameStore().set(path, shortName)
})

export const ZOTZ_SHORT_NAME_METHODS = [ZOTZ_SHORT_NAMES_LIST_METHOD, ZOTZ_SHORT_NAME_SET_METHOD]
