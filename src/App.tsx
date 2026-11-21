import React from 'react';
import { KullaniciSaglayici } from './OrtakHavuz/KullaniciHafizasi';
import { SubeYoneticisiPaneli } from './VitrinOdasi/SubePaneli/SubeYoneticisiPaneli';

export default function App() {
  return (
    <KullaniciSaglayici>
      <SubeYoneticisiPaneli />
    </KullaniciSaglayici>
  );
}
