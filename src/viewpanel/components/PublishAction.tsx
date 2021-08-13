

import * as React from 'react';
import { CommandToCode } from '../CommandToCode';
import { MessageHelper } from '../helper/MessageHelper';
import { ActionButton } from './ActionButton';

export interface IPublishActionProps {
  draft: boolean;
}

export const PublishAction: React.FunctionComponent<IPublishActionProps> = (props: React.PropsWithChildren<IPublishActionProps>) => {
  const { draft } = props;

  const publish = () => {
    MessageHelper.sendMessage(CommandToCode.publish);
  };

  return (
    <ActionButton onClick={publish} className={`${draft ? "" : "secondary"}`} title={draft ? "Publish" : "Revert to draft"} />
  );
};