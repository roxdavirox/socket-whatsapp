import { Ok, isOk, fromNullable, isSome } from '@tecnomancy/alchemy'
import type { Agent } from './types.js'
import type { UserRepo } from '../../domain/ports/user-repo.js'

export const createRoutingAgent = (userRepo: UserRepo): Agent =>
  async (ctx) => {
    const assigned = fromNullable(ctx.contact.assignedUserId)
    if (isSome(assigned)) return Ok({ type: 'pass' as const, context: ctx })

    const operators = await userRepo.getOperators()
    if (!isOk(operators) || operators.value.length === 0) {
      return Ok({ type: 'pass' as const, context: ctx })
    }

    const selected = operators.value[Math.floor(Math.random() * operators.value.length)]
    if (!selected) return Ok({ type: 'pass' as const, context: ctx })

    return Ok({
      type: 'route' as const,
      operatorId: selected.id,
      context: {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          routing: { assignedTo: selected.id, strategy: 'round_robin' },
        },
      },
    })
  }
