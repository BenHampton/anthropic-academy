import type { Meta, StoryObj } from '@storybook/react-vite'
import { CanInfoCard } from './CanInfoCard'
import { cans } from '../data/cans'

const meta = {
  title: 'AR/CanInfoCard',
  component: CanInfoCard,
  // the card is absolutely positioned against the ar overlay, so give it one
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: '100dvh' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof CanInfoCard>

export default meta
type Story = StoryObj<typeof meta>

/** nothing tracked — the card is mounted but animated out */
export const Empty: Story = {
  args: { can: null }
}

export const CocaCola: Story = {
  args: { can: cans[0] ?? null }
}

export const Sprite: Story = {
  args: { can: cans[1] ?? null }
}

export const FantaOrange: Story = {
  args: { can: cans[2] ?? null }
}

/** long names must not push the stats off the card */
export const LongName: Story = {
  args: {
    can: {
      id: 'long',
      targetImages: ['long.jpg'],
      name: 'Extremely Long Sparkling Drink Name',
      flavour: 'Blood orange, rhubarb & bitters',
      calories: 1234,
      volumeMl: 500,
      bodyColor: '#8e44ad',
      scale: 1
    }
  }
}
