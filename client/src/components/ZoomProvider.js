import React, { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

const ZoomProvider = ({ children }) => {
  const { getPref } = useSettings();
  const zoomLevel = getPref('general', 'zoomLevel') || '100';

  useEffect(() => {
    const parsed = parseInt(zoomLevel);
    const zoom = isNaN(parsed) ? 1 : parsed / 100;
    document.body.style.zoom = `${zoom}`;
    return () => { document.body.style.zoom = '1'; };
  }, [zoomLevel]);

  return <>{children}</>;
};

export default ZoomProvider;
