import { Menu } from '@headlessui/react';
import * as React from 'react';
import { useRecoilState } from 'recoil';
import { GroupOption } from '../../constants/GroupOption';
import { GroupingAtom } from '../../state';
import { MenuButton, MenuItem, MenuItems } from '../Menu';

export interface IGroupingProps {}

export const GROUP_OPTIONS = [
  { name: 'None', id: GroupOption.none },
  { name: 'Year', id: GroupOption.Year },
  { name: 'Draft/Published', id: GroupOption.Draft }
];

export const Grouping: React.FunctionComponent<
  IGroupingProps
> = ({}: React.PropsWithChildren<IGroupingProps>) => {
  const [group, setGroup] = useRecoilState(GroupingAtom);

  const crntGroup = GROUP_OPTIONS.find((x) => x.id === group);

  return (
    <div className="flex items-center">
      <Menu as="div" className="relative z-10 inline-block text-left">
        <MenuButton label={`Group by`} title={crntGroup?.name || ''} />

        <MenuItems disablePopper>
          {GROUP_OPTIONS.map((option) => (
            <MenuItem
              key={option.id}
              title={option.name}
              value={option.id}
              isCurrent={option.id === crntGroup?.id}
              onClick={(value) => setGroup(value)}
            />
          ))}
        </MenuItems>
      </Menu>
    </div>
  );
};
