import { canBuy, nextCost, SHOP_ITEMS, type ShopItem } from '../engine/shop.ts'
import { buyItem } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'

/** 업적 상점: 업적을 달성해 모은 토큰으로 다음 판들에 쓰는 보너스를 산다. */
export function shopScreen(ctx: Ctx): HTMLElement {
  const root = h('main', { class: 'screen shop' })

  const itemCard = (item: ShopItem) => {
    const inv = ctx.meta.inventory
    const owned = inv[item.id] ?? 0
    const cost = nextCost(item, inv)
    const ownedText = item.kind === 'stock' ? `보유 ${owned}장${item.max ? ` / 최대 ${item.max}` : ''}` : `${owned} / ${item.costs?.length ?? 0}단계`
    return h(
      'section',
      { class: 'card' },
      h('div', { class: 'row' }, h('b', {}, item.name), h('span', { class: 'chip' }, ownedText)),
      h('p', { class: 'muted small' }, item.desc),
      h(
        'button',
        {
          class: 'btn small',
          disabled: !canBuy(item, inv, ctx.meta.tokens),
          onclick: () => {
            const next = buyItem(ctx.storage, item.id)
            if (next) ctx.meta = next
            render()
          },
        },
        cost === null ? '구매 완료' : `토큰 ${cost}개로 ${item.kind === 'level' && owned > 0 ? '강화' : '구매'}`,
      ),
    )
  }

  const render = () => {
    root.replaceChildren(
      h('p', { class: 'eyebrow' }, '업적 상점'),
      h('h2', {}, `🪙 토큰 ${ctx.meta.tokens}개`),
      h('p', { class: 'muted small' }, `업적을 처음 달성하면 토큰 3개, 다시 달성하면 1개를 받아요. 지금까지 모은 토큰 ${ctx.meta.tokensEarned}개.`),
      ...SHOP_ITEMS.map(itemCard),
      h('button', { class: 'btn', onclick: () => ctx.toTitle() }, '타이틀로'),
    )
  }
  render()
  return root
}
