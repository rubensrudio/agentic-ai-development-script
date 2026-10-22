import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CompanyPage, Scope } from '@contracts/api.models';
import { of } from 'rxjs';

import { CompaniesApi } from '../../core/api/company.api';
import { AuthService } from '../../core/auth.service';
import { CompanyListPage } from './company-list.page';

const PAGE: CompanyPage = {
  items: [
    {
      id: 1,
      name: 'Acme',
      legal_name: 'Acme Corp',
      tax_id: '123',
      email: 'hello@acme.test',
      phone: null,
      address: null,
      is_active: true,
      created_by_id: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  size: 20,
};

describe('CompanyListPage', () => {
  let fixture: ComponentFixture<CompanyListPage>;
  let list: ReturnType<typeof vi.fn>;

  async function render(scopes: Scope[]): Promise<HTMLElement> {
    list = vi.fn().mockReturnValue(of(PAGE));
    await TestBed.configureTestingModule({
      imports: [CompanyListPage],
      providers: [
        provideRouter([]),
        { provide: CompaniesApi, useValue: { list, delete: vi.fn() } },
        { provide: AuthService, useValue: { hasScope: (s: Scope) => scopes.includes(s) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CompanyListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function newButton(host: HTMLElement): Element | undefined {
    return Array.from(host.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('New company'),
    );
  }

  it('loads the first page and renders the rows', async () => {
    const host = await render(['companies:list']);
    expect(list).toHaveBeenCalledWith({ page: 1, size: 20, q: '' });
    expect(host.textContent).toContain('Acme');
    expect(host.textContent).toContain('123');
  });

  it('hides New, edit and delete with only the list scope', async () => {
    const host = await render(['companies:list']);
    expect(newButton(host)).toBeUndefined();
    expect(host.querySelector('[data-testid="edit"]')).toBeNull();
    expect(host.querySelector('[data-testid="delete"]')).toBeNull();
  });

  it('shows each button only with its own scope', async () => {
    const host = await render(['companies:list', 'companies:create', 'companies:delete']);
    expect(newButton(host)).toBeDefined();
    expect(host.querySelector('[data-testid="edit"]')).toBeNull();
    expect(host.querySelector('[data-testid="delete"]')).not.toBeNull();
  });

  it('shows the edit button with the update scope', async () => {
    const host = await render(['companies:list', 'companies:update']);
    expect(newButton(host)).toBeUndefined();
    expect(host.querySelector('[data-testid="edit"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="delete"]')).toBeNull();
  });
});
