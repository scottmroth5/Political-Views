import { z } from "zod";
import { QuestionForm, type QuestionFormInitial } from "@/components/admin/QuestionForm";
import {
  getAdminQuestion,
  listCategoriesWithTopics,
} from "@/domain/questions/question-admin-service";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = { title: "Add a question · Admin · Political Views" };
export const dynamic = "force-dynamic";

const DEFAULT_EXPLANATION = "Optional: in your own words, why do you feel this way?";

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdminPage();
  const { from } = await searchParams;
  const sourceId = z.uuid().safeParse(from);
  const [categories, source] = await Promise.all([
    listCategoriesWithTopics(),
    sourceId.success ? getAdminQuestion(sourceId.data) : Promise.resolve(null),
  ]);

  const firstCategory = categories[0];
  const initial: QuestionFormInitial = source
    ? {
        categoryId: source.category.id,
        topicId: source.topic.id,
        prompt: source.prompt,
        explanationPrompt: source.explanationPrompt ?? "",
        responseType: source.responseType === "MULTI_CHOICE" ? "MULTI_CHOICE" : "SINGLE_CHOICE",
        choices: source.choices.map((c) => ({ label: c.label, exclusive: c.exclusive === true })),
      }
    : {
        categoryId: firstCategory?.id ?? "",
        topicId: firstCategory?.topics[0]?.id ?? "__new__",
        prompt: "",
        explanationPrompt: DEFAULT_EXPLANATION,
        responseType: "SINGLE_CHOICE",
        choices: [
          { label: "", exclusive: false },
          { label: "", exclusive: false },
          { label: "", exclusive: false },
        ],
      };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {source ? "Copy a question" : "Add a question"}
      </h1>
      <QuestionForm
        categories={categories}
        initial={initial}
        copyOf={
          source
            ? { id: source.id, prompt: source.prompt, archived: source.status === "archived" }
            : null
        }
      />
    </div>
  );
}
