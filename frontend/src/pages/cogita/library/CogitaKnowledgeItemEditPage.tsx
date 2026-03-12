import { CogitaLibraryAddPage, type CogitaLibraryAddPageProps } from './CogitaLibraryAddPage';

export type CogitaKnowledgeItemEditPageProps = Omit<CogitaLibraryAddPageProps, 'editInfoId'> & {
  infoId?: string;
};

export function CogitaKnowledgeItemEditPage({ infoId, ...props }: CogitaKnowledgeItemEditPageProps) {
  return <CogitaLibraryAddPage {...props} editInfoId={infoId} />;
}

