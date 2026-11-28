import type {
  ZotzFlowNodeKind,
  ZotzFlowNodeOf
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowTemplateOption } from './zotz-flow-template-options'

export type ZotzFlowKindFieldsProps<K extends ZotzFlowNodeKind> = {
  node: ZotzFlowNodeOf<K>
  onChange: (update: (node: ZotzFlowNodeOf<K>) => ZotzFlowNodeOf<K>) => void
  options: readonly ZotzFlowTemplateOption[]
  /** Localized problem for a template field, as the contract names it (`prompt`, `env.TOKEN`…). */
  fieldError: (field: string) => string | null
}
