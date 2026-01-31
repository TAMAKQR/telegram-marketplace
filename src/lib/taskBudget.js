const toNumber = (value) => {
    if (value === null || value === undefined) return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
}

const formatSom = (value) => {
    const n = toNumber(value)
    if (n === null) return '0'

    // keep integers clean
    const isInt = Number.isInteger(n)
    return isInt ? n.toLocaleString('ru-RU') : n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export const getTaskBudgetRange = (task) => {
    const tiers = Array.isArray(task?.pricing_tiers) ? task.pricing_tiers : []
    if (tiers.length === 0) {
        const budget = toNumber(task?.budget)
        const safeBudget = budget === null ? 0 : budget
        return { min: safeBudget, max: safeBudget, isRange: false, source: 'budget' }
    }

    const required = task?.target_metrics && typeof task.target_metrics === 'object' ? task.target_metrics : {}

    // NOTE: pricing_tiers are treated as "tier price at threshold" (NOT incremental).
    // For each metric:
    // - min payout = payout at required threshold (target_metrics), else at the lowest tier.
    // - max payout = payout at the highest tier.
    const tiersByMetric = new Map()
    for (const tier of tiers) {
        const metric = tier?.metric || 'views'
        const min = toNumber(tier?.min)
        if (min === null) continue
        const price = toNumber(tier?.price)
        const list = tiersByMetric.get(metric) || []
        list.push({ min, price: price === null ? 0 : price })
        tiersByMetric.set(metric, list)
    }

    let min = 0
    let max = 0

    for (const [metric, list] of tiersByMetric.entries()) {
        const sorted = [...list].sort((a, b) => a.min - b.min)
        const requiredMin = toNumber(required?.[metric])
        const fallbackMin = sorted[0]?.min
        const threshold = requiredMin === null ? fallbackMin : requiredMin

        const maxPrice = sorted.reduce((acc, t) => Math.max(acc, t.price ?? 0), 0)
        const minPrice = sorted
            .filter(t => threshold !== undefined && t.min <= threshold)
            .reduce((acc, t) => Math.max(acc, t.price ?? 0), 0)

        min += minPrice
        max += maxPrice
    }

    return { min, max, isRange: min !== max, source: 'pricing_tiers' }
}

export const formatTaskBudget = (task, options = {}) => {
    const { prefix = '💰 ' } = options
    const { min, max, isRange } = getTaskBudgetRange(task)

    if (!isRange) {
        return `${prefix}${formatSom(max)} сом`
    }

    return `${prefix}от ${formatSom(min)} до ${formatSom(max)} сом`
}
