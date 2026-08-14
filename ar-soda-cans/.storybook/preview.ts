import type { Preview } from '@storybook/react-vite'
import '../src/styles/global.css'
import '../src/styles/ui.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'camera',
      values: [
        // approximates a camera feed so the frosted panels read correctly
        { name: 'camera', value: '#2a2f36' },
        { name: 'app', value: '#0b0d10' }
      ]
    }
  }
}

export default preview
