import { buyCosmetic, CATALOG, equipCosmetic, equippedOf, limitedStock, ownedIds, shopBlocker, SLOTS, type CosmeticDef } from '../engine/cosmetics.ts'
import type { GameState } from '../engine/state.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { itemArtSvg, roomSceneSvg } from './roomScene.ts'
import { openSheet } from './sheet.ts'
import { playSfx } from './sound.ts'

/**
 * 상점과 내 방 꾸미기 팝업. 시즌 한정 입고 상품, 칸별 상시 판매 상품, 가진 상품의 장착을 한곳에서 한다.
 * 꾸미기는 외형만 바꾸고 능력에는 영향이 없다. 바뀐 상태(구매·장착 반영)를 돌려준다.
 */
export function openShop(initial: GameState): Promise<GameState> {
  let state = initial
  return openSheet<GameState>(
    (close) => {
      const root = h('div', { class: 'stack-tight shop-sheet' })
      const message = h('p', { class: 'muted small', 'aria-live': 'polite' }, '')

      const card = (def: CosmeticDef) => {
        const owned = ownedIds(state).includes(def.id)
        const equipped = equippedOf(state)[def.slot] === def.id
        const reason = shopBlocker(state, def.id)
        const art = h('div', { class: `item-art ${def.slot}` })
        art.innerHTML = itemArtSvg(def)
        const action = owned
          ? h('button', { class: `btn small${equipped ? ' primary' : ''}`, disabled: equipped, onclick: () => ((state = equipCosmetic(state, def.id)), draw()) }, equipped ? '장착 중' : '장착')
          : h(
              'button',
              {
                class: 'btn small',
                disabled: !!reason,
                onclick: () => {
                  const r = buyCosmetic(state, def.id)
                  if (r.ok) {
                    state = equipCosmetic(r.state, def.id)
                    playSfx('upgrade')
                    message.textContent = `${def.name}을(를) 샀어요. 바로 장착했어요.`
                  }
                  draw()
                },
              },
              def.price > 0 ? formatMoney(def.price) : '무료',
            )
        return h(
          'div',
          { class: `item-card${equipped ? ' on' : ''}${def.limited ? ' limited' : ''}` },
          art,
          h('div', { class: 'item-text' }, h('strong', {}, def.name, def.limited && h('span', { class: 'chip new-chip' }, '한정')), h('span', { class: 'muted small' }, def.desc), !owned && reason && h('span', { class: 'muted small' }, `— ${reason}`)),
          action,
        )
      }

      const draw = () => {
        const preview = h('div', { class: 'room-preview' })
        preview.innerHTML = roomSceneSvg(state)
        const stock = limitedStock(state)
        const owned = ownedIds(state)
        const visible = (def: CosmeticDef) => owned.includes(def.id) || (!def.limited && !def.collab)
        root.replaceChildren(
          h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, '상점 · 내 방'), h('span', { class: 'muted small' }, `보유 돈 ${formatMoney(state.money)}`)),
          preview,
          message,
          h('h3', {}, '이번 시즌 한정 입고'),
          h('p', { class: 'muted small' }, '시즌마다 입고 상품이 바뀝니다. 이번 시즌에 사지 않으면 다음 기회를 기다려야 해요.'),
          ...stock.map(card),
          ...SLOTS.flatMap((slot) => [h('h3', {}, slot.name), ...CATALOG.filter((c) => c.slot === slot.id && visible(c) && !(c.limited && stock.some((s) => s.id === c.id))).map(card)]),
          h('p', { class: 'muted small' }, '콜라보 이벤트로만 받을 수 있는 상품은 받은 뒤에 이곳에 나타납니다.'),
          h('button', { class: 'btn primary', onclick: () => close(state) }, '닫기'),
        )
      }

      draw()
      return root
    },
    { autofocus: false },
  )
}
