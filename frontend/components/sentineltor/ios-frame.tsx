'use client'

import React from 'react'

export function IOSDevice({ children, width = 402, height = 874, dark = false }: { children: React.ReactNode; width?: number; height?: number; dark?: boolean }) {
  return (
    <div style={{ 
      width, 
      height, 
      borderRadius: 48, 
      overflow: 'hidden', 
      position: 'relative', 
      background: dark ? '#000' : '#F2F2F7', 
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)', 
      fontFamily: '-apple-system, system-ui, sans-serif', 
      WebkitFontSmoothing: 'antialiased',
      paddingTop: 16
    }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
