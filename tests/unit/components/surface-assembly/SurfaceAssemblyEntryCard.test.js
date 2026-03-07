import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SurfaceAssemblyEntryCard from '@/components/surface-assembly/SurfaceAssemblyEntryCard.vue';

const buttonStub = {
  emits: ['click'],
  template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
};

describe('SurfaceAssemblyEntryCard', () => {
  it('shows a build call to action when no committed assembly exists', async () => {
    const wrapper = mount(SurfaceAssemblyEntryCard, {
      props: {
        hasAssembly: false,
      },
      global: {
        stubs: {
          Button: buttonStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Build Surface Assembly');

    await wrapper.get('[data-testid="surface-assembly-entry-open"]').trigger('click');

    expect(wrapper.emitted('open-composer')).toEqual([[expect.any(Object)]]);
  });

  it('shows an edit call to action when a committed assembly exists', () => {
    const wrapper = mount(SurfaceAssemblyEntryCard, {
      props: {
        hasAssembly: true,
      },
      global: {
        stubs: {
          Button: buttonStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Edit Surface Assembly');
    expect(wrapper.text()).toContain('review the preview below');
  });
});
