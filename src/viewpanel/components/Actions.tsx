import * as React from 'react';
import { PanelSettings } from '../../models/PanelSettings';
import { CommandToCode } from '../CommandToCode';
import { MessageHelper } from '../helper/MessageHelper';
import { ActionButton } from './ActionButton';
import { Collapsible } from './Collapsible';
import { CustomScript } from './CustomScript';
import { DateAction } from './DateAction';
import { PublishAction } from './PublishAction';
import { SlugAction } from './SlugAction';

export interface IActionsProps {
  metadata: any;
  settings: PanelSettings;
}

export const Actions: React.FunctionComponent<IActionsProps> = (props: React.PropsWithChildren<IActionsProps>) => {
  const { metadata, settings } = props;

  if (!metadata || Object.keys(metadata).length === 0 || !settings) {
    return null;
  }

  return (
    <Collapsible id={`actions`} title="Actions">
      <div className={`article__actions`}>

        <ActionButton onClick={() => MessageHelper.sendMessage(CommandToCode.toggleCenterMode)} title={`Toggle center mode`} />

        { metadata && metadata.title && <SlugAction value={metadata.title} crntValue={metadata.slug} slugOpts={settings.slug} /> }

        <DateAction />

        { metadata && typeof metadata.draft !== undefined && <PublishAction draft={metadata.draft} />}

        {
          (settings && settings.scripts && settings.scripts.length > 0) && (
            settings.scripts.map((value) => (
              <CustomScript key={value.title.replace(/ /g, '')} {...value} />
            ))
          )
        }
      </div>
    </Collapsible>
  );
};