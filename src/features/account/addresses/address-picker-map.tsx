'use client';

import { useState } from 'react';
import { MapPin, Search, Navigation, Check } from 'lucide-react';
import { useShop } from '@/components/shop-context';

export interface AddressCoordinates {
  latitude: number;
  longitude: number;
}

export function AddressPickerMap({
  initialLat,
  initialLng,
  city,
  street,
  house,
  onLocationSelect,
}: {
  initialLat?: number;
  initialLng?: number;
  city?: string;
  street?: string;
  house?: string;
  onLocationSelect: (coords: AddressCoordinates) => void;
}) {
  const s = useShop();
  const [lat, setLat] = useState<number | undefined>(initialLat);
  const [lng, setLng] = useState<number | undefined>(initialLng);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ display_name: string; lat: string; lon: string }>
  >([]);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      s.notice('Геолокация недоступна в вашем браузере');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = Number(position.coords.latitude.toFixed(6));
        const newLng = Number(position.coords.longitude.toFixed(6));
        setLat(newLat);
        setLng(newLng);
        onLocationSelect({ latitude: newLat, longitude: newLng });
        s.notice('Местоположение определено');
      },
      () => {
        s.notice('Не удалось определить местоположение. Попробуйте поиск по адресу.');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleAddressSearch = async () => {
    const query = searchQuery || [city, street, house].filter(Boolean).join(', ');
    if (!query || query.length < 3) {
      s.notice('Введите адрес для поиска');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { Accept: 'application/json' } },
      );
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        s.notice('Адрес не найден на карте');
        setSearchResults([]);
      }
    } catch {
      s.notice('Ошибка геокодирования адреса');
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (res: { lat: string; lon: string; display_name: string }) => {
    const newLat = Number(Number(res.lat).toFixed(6));
    const newLng = Number(Number(res.lon).toFixed(6));
    setLat(newLat);
    setLng(newLng);
    setSearchResults([]);
    onLocationSelect({ latitude: newLat, longitude: newLng });
    s.notice('Точка на карте зафиксирована');
  };

  const embedUrl = lat !== undefined && lng !== undefined
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.005}%2C${lng + 0.008}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`
    : null;

  return (
    <div className="address-picker-container">
      <div className="picker-toolbar">
        <button
          type="button"
          className="secondary location-detect-button"
          onClick={handleGeolocation}
        >
          <Navigation size={16} /> Моё местоположение
        </button>

        <div className="address-search-form">
          <input
            type="text"
            placeholder={
              [city, street, house].filter(Boolean).join(', ') || 'Найти адрес на карте'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAddressSearch();
              }
            }}
          />
          <button type="button" className="secondary" disabled={searching} onClick={() => void handleAddressSearch()}>
            <Search size={16} />
          </button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results-dropdown">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className="search-result-item"
              onClick={() => selectResult(item)}
            >
              <MapPin size={15} />
              <span>{item.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="interactive-map-frame">
        {embedUrl ? <iframe
          title="Выбор точки доставки на карте"
          src={embedUrl}
          loading="lazy"
          className="osm-iframe"
        /> : <div className="map-empty-state">Выберите точку с помощью поиска или геолокации, чтобы увидеть её на карте.</div>}
        <div className="map-badge">
          {lat !== undefined && lng !== undefined ? (
            <span>
              <Check size={14} /> Точка доставки выбрана ({lat}, {lng})
            </span>
          ) : (
            <span>Укажите точку на карте</span>
          )}
        </div>
      </div>
    </div>
  );
}
