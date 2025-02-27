import * as React from 'react'

interface ISettingsProviderProps {
  version?: string;
  experimental?: boolean;
  aiUrl?: string;
}

const SettingsContext = React.createContext<ISettingsProviderProps | undefined>(undefined);

const SettingsProvider: React.FunctionComponent<ISettingsProviderProps> = ({ version, experimental, aiUrl, children }: React.PropsWithChildren<ISettingsProviderProps>) => {
  return (
    <SettingsContext.Provider
      value={{
        version,
        experimental,
        aiUrl
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
};

const useSettingsContext = (): ISettingsProviderProps => {
  const loadFunc = React.useContext(SettingsContext);

  if (loadFunc === undefined) {
    throw new Error('useSettingsContext must be used within the SettingsProvider');
  }

  return loadFunc;
};

SettingsContext.displayName = 'SettingsContext';
SettingsProvider.displayName = 'SettingsProvider';

export { SettingsProvider, useSettingsContext };
