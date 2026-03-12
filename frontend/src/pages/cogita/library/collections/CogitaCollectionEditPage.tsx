import { CogitaCollectionCreatePage, type CogitaCollectionCreatePageProps } from './CogitaCollectionCreatePage';

export type CogitaCollectionEditPageProps = Omit<CogitaCollectionCreatePageProps, 'collectionId'> & {
  collectionId?: string;
};

export function CogitaCollectionEditPage({ collectionId, ...props }: CogitaCollectionEditPageProps) {
  return <CogitaCollectionCreatePage {...props} collectionId={collectionId} />;
}

