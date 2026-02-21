import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("VirtualCards Page", () => {
  it("renders loading state initially", async () => {
    const VirtualCards = (await import("@/pages/VirtualCards")).default;
    const { container } = renderWithProviders(<VirtualCards />);
    // Should render skeleton loading elements
    expect(container.innerHTML).toContain("skeleton");
  });
});

describe("CreateCardForm", () => {
  it("renders form fields", async () => {
    const { CreateCardForm } = await import(
      "@/components/virtual-cards/CreateCardForm"
    );
    const { container } = renderWithProviders(
      <CreateCardForm onSuccess={() => {}} onCancel={() => {}} />
    );
    expect(container.querySelector('input#cardName')).toBeTruthy();
    expect(container.innerHTML).toContain("Create Card");
    expect(container.innerHTML).toContain("Cancel");
  });

  it("shows important information section", async () => {
    const { CreateCardForm } = await import(
      "@/components/virtual-cards/CreateCardForm"
    );
    const { container } = renderWithProviders(
      <CreateCardForm onSuccess={() => {}} onCancel={() => {}} />
    );
    expect(container.innerHTML).toContain("Important Information");
    expect(container.innerHTML).toContain("USD");
  });
});
