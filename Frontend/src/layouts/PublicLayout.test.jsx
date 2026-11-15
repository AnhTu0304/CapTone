import React from 'react';
import { render } from '@testing-library/react';
import PublicLayout from './PublicLayout';

describe('PublicLayout', () => {
  it('renders blueprint gutters on default public routes', () => {
    const { container } = render(
      <PublicLayout currentPath="/">
        <div>Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).not.toBeInTheDocument();
  });

  it('hides blueprint gutters on /security route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/security">
        <div>Security Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });

  it('hides blueprint gutters on /about route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/about">
        <div>About Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });

  it('hides blueprint gutters on /guide route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/guide">
        <div>Guide Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });

  it('hides blueprint gutters on /privacy route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/privacy">
        <div>Privacy Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });

  it('hides blueprint gutters on /terms route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/terms">
        <div>Terms Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });

  it('hides blueprint gutters on /features route for full-width sheet', () => {
    const { container } = render(
      <PublicLayout currentPath="/features">
        <div>Features Content</div>
      </PublicLayout>
    );

    expect(container.querySelector('.blueprint-gutter-left')).not.toBeInTheDocument();
    expect(container.querySelector('.blueprint-gutter-right')).not.toBeInTheDocument();
    expect(container.querySelector('.public-layout--no-gutters')).toBeInTheDocument();
  });
});
