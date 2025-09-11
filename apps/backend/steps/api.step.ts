import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { petStoreService } from '../services/pet-store'
import { petSchema } from '../services/types'
import { withAuth, sanitizeInput, checkRateLimit } from '../middleware/auth.middleware'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ApiTrigger',
  description: 'basic-tutorial api trigger',
  flows: ['basic-tutorial'],

  method: 'POST',
  path: '/basic-tutorial',
  bodySchema: z.object({
    pet: z.object({
      name: z.string(),
      photoUrl: z.string(),
    }),
    foodOrder: z
      .object({
        id: z.string(),
        quantity: z.number(),
      })
      .optional(),
  }),
  responseSchema: {
    200: petSchema,
  },
  emits: ['process-food-order'],
}

// Wrap handler with authentication and rate limiting
export const handler: Handlers['ApiTrigger'] = withAuth(
  async (req, { logger, traceId, emit }) => {
    logger.info('Step 01 – Processing API Step', { 
      userId: req.auth.userId,
      body: req.body 
    })

    // Sanitize input
    const bodySchema = z.object({
      pet: z.object({
        name: z.string().min(1).max(100),
        photoUrl: z.string().url(),
      }),
      foodOrder: z
        .object({
          id: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(100),
        })
        .optional(),
    })

    const sanitizedBody = sanitizeInput(req.body, bodySchema)
    const { pet, foodOrder } = sanitizedBody
    
    // Create pet with user context
    const newPetRecord = await petStoreService.createPet({
      ...pet,
      userId: req.auth.userId,
    })

    if (foodOrder) {
      await emit({
        topic: 'process-food-order',
        data: {
          ...foodOrder,
          email: req.auth.email || 'user@example.com',
          petId: newPetRecord.id,
          userId: req.auth.userId,
        },
      })
    }

    return { status: 200, body: {...newPetRecord, traceId } }
  },
  {
    rateLimit: { limit: 100, windowMs: 60000 }, // 100 requests per minute
    resource: 'pets',
    action: 'create',
  }
)
