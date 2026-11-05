import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · NOVA` : 'NOVA — Plan. Collaborate. Deliver.';
  }, [title]);
};

export default usePageTitle;
