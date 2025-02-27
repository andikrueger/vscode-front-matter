import * as React from 'react';
import { useEffect } from 'react';
import { SEO } from '../../models/PanelSettings';
import { TagType } from '../TagType';
import { ArticleDetails } from './ArticleDetails';
import { Collapsible } from './Collapsible';
import FieldBoundary from './ErrorBoundary/FieldBoundary';
import { SymbolKeywordIcon } from './Icons/SymbolKeywordIcon';
import { SeoFieldInfo } from './SeoFieldInfo';
import { SeoKeywords } from './SeoKeywords';
import { TagPicker } from './TagPicker';
import { VsTable, VsTableBody, VsTableHeader, VsTableHeaderCell } from './VscodeComponents';

export interface ISeoStatusProps {
  seo: SEO;
  data: any;
  focusElm: TagType | null;
  unsetFocus: () => void;
}

const SeoStatus: React.FunctionComponent<ISeoStatusProps> = ({
  data,
  seo,
  focusElm,
  unsetFocus
}: React.PropsWithChildren<ISeoStatusProps>) => {
  const { title, slug } = data;
  const [isOpen, setIsOpen] = React.useState(true);
  const tableRef = React.useRef<HTMLElement>();
  const pushUpdate = React.useRef((value: boolean) => {
    setTimeout(() => {
      setIsOpen(value);
    }, 10);
  }).current;

  const { descriptionField, titleField } = seo;

  // Workaround for lit components not updating render
  useEffect(() => {
    setTimeout(() => {
      let height = 0;

      tableRef.current?.childNodes.forEach((elm: any) => {
        height += elm.clientHeight;
      });

      if (height > 0 && tableRef.current) {
        tableRef.current.style.height = `${height}px`;
      }
    }, 10);
  }, [title, data[titleField], data[descriptionField], data?.articleDetails?.wordCount]);

  const renderContent = () => {
    if (!isOpen) {
      return null;
    }

    return (
      <div>
        <div className={`seo__status__details`}>
          <h4>Recommendations</h4>

          <VsTable ref={tableRef} bordered zebra>
            <VsTableHeader slot="header">
              <VsTableHeaderCell className={`table__cell`}>Property</VsTableHeaderCell>
              <VsTableHeaderCell className={`table__cell`}>Length</VsTableHeaderCell>
              <VsTableHeaderCell className={`table__cell`}>Valid</VsTableHeaderCell>
            </VsTableHeader>
            <VsTableBody slot="body">
              {data[titleField] && seo.title > 0 && (
                <SeoFieldInfo
                  title={titleField}
                  value={data[titleField].length}
                  recommendation={`${seo.title} chars`}
                  isValid={data[titleField].length <= seo.title}
                />
              )}

              {slug && seo.slug > 0 && (
                <SeoFieldInfo
                  title={`slug`}
                  value={slug.length}
                  recommendation={`${seo.slug} chars`}
                  isValid={slug.length <= seo.slug}
                />
              )}

              {data[descriptionField] && seo.description > 0 && (
                <SeoFieldInfo
                  title={descriptionField}
                  value={data[descriptionField].length}
                  recommendation={`${seo.description} chars`}
                  isValid={data[descriptionField].length <= seo.description}
                />
              )}

              {seo.content > 0 && data?.articleDetails?.wordCount > 0 && (
                <SeoFieldInfo
                  title={`Article length`}
                  value={data?.articleDetails?.wordCount}
                  recommendation={`${seo.content} words`}
                />
              )}
            </VsTableBody>
          </VsTable>
        </div>

        <SeoKeywords
          keywords={data?.keywords}
          title={title}
          description={data[descriptionField]}
          slug={data.slug}
          headings={data?.articleDetails?.headingsText}
          wordCount={data?.articleDetails?.wordCount}
          content={data?.articleDetails?.content}
        />

        <FieldBoundary fieldName={`Keywords`}>
          <TagPicker
            type={TagType.keywords}
            icon={<SymbolKeywordIcon />}
            crntSelected={(data.keywords as string[]) || []}
            options={[]}
            freeform={true}
            focussed={focusElm === TagType.keywords}
            unsetFocus={unsetFocus}
            disableConfigurable
          />
        </FieldBoundary>

        <ArticleDetails details={data.articleDetails} />
      </div>
    );
  };

  return (
    <Collapsible id={`seo`} title="SEO Status" sendUpdate={pushUpdate}>
      {!title && !data[descriptionField] ? (
        <div className={`seo__status__empty`}>
          <p>
            <b>Title</b> or <b>{descriptionField}</b> is needed.
          </p>
        </div>
      ) : (
        renderContent()
      )}
    </Collapsible>
  );
};

SeoStatus.displayName = 'SeoStatus';
export { SeoStatus };
