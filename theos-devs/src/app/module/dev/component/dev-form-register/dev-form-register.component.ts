import { AfterViewInit, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { GitHubService } from '../../../../core/service/git-hub/git-hub.service';
import { IbgeService } from '../../../../core/service/ibge/ibge.service';
import { InputSelect } from '../../../../shared/interface/input-select.interface';
import { IbgeMunicipio } from '../../../../shared/model/ibge/ibge-municipio';
import { IbgeUF } from '../../../../shared/model/ibge/ibge-uf';
import { FormacaoAcademicaType } from '../../../../shared/type/formacao-academica.type';
import { StringUtil } from '../../../../shared/util/string-util';
import { Dev } from '../../model/dev';
import { DevService } from '../../service/dev.service';

@Component({
  selector: 'app-dev-form-register',
  templateUrl: './dev-form-register.component.html',
  styleUrls: ['./dev-form-register.component.scss']
})
export class DevFormRegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input()
  public dev: Dev;

  public devFormRegister: FormGroup;

  public formacoesAcademicas: Array<InputSelect>;

  public estados: Array<IbgeUF>;

  public municipios: Array<IbgeMunicipio>;

  public faSearch: IconDefinition = faSearch;

  private subs: Array<Subscription> = new Array<Subscription>();

  constructor(
    private formBuilder: FormBuilder,
    private gitHubService: GitHubService,
    private ibgeService: IbgeService,
    private devService: DevService
  ) {}

  ngOnInit(): void {
    this.createForm();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.getFormacoesAcademicas();
    }, 200);
    this.getEstados();

    if (this.dev) {
      this.loadDev(this.dev);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((sub) => sub.unsubscribe);
  }

  private createForm(): void {
    this.devFormRegister = new Dev().createForm(this.formBuilder);

    this.subs.push(
      this.devFormRegister.get('estado').valueChanges.subscribe((value) => {
        if (value) {
          this.devFormRegister.get('cidade').disable();
          this.getMunicipiosPorEstado(value);
        }
      })
    );
  }

  private loadDev(dev: Dev): void {
    setTimeout(() => {
      this.devFormRegister.patchValue(dev);
      this.devFormRegister.get('estado').setValue(dev.estado.sigla);
      this.devFormRegister.get('cidade').setValue(dev.cidade.id);
    }, 200)
  }

  public getUserGitHub(): void {
    this.gitHubService
      .getUserByLogin(this.devFormRegister.get('gitHubLogin').value)
      .pipe(take(1))
      .subscribe(
        (gitHubUser) => {
          if (gitHubUser) {
            this.devFormRegister.get('gitHubUser').setValue(gitHubUser);
            this.devFormRegister.get('avatar').setValue(gitHubUser.avatar_url);
            gitHubUser.name ? this.devFormRegister.get('nome').setValue(gitHubUser.name) : undefined;
            gitHubUser.email ? this.devFormRegister.get('email').setValue(gitHubUser.email) : undefined;
          }
        },
        (error) => {
          alert(`Usuário "${this.devFormRegister.get('gitHubLogin').value}" não encontrado no GitHub.`);
        }
      );
  }

  private getFormacoesAcademicas(): void {
    this.formacoesAcademicas = new Array<InputSelect>();

    FormacaoAcademicaType.getKeys().forEach((value) => {
      this.formacoesAcademicas.push({
        label: FormacaoAcademicaType.getLabel(value),
        value: value
      });
    });

    this.formacoesAcademicas.length
      ? this.devFormRegister.get('formacaoAcademica').enable()
      : this.devFormRegister.get('formacaoAcademica').disable();
  }

  private getEstados(): void {
    this.ibgeService
      .getEstados()
      .pipe(take(1))
      .subscribe(
        (estados) => {
          this.devFormRegister.get('estado').enable();
          this.estados = StringUtil.alphabeticalOrder(estados) as Array<IbgeUF>;
        },
        (error) => {
          this.devFormRegister.get('estado').disable();
          alert('Não foi possível obter a lista de estados.');
        }
      );
  }

  public getMunicipiosPorEstado(uf: string): void {
    if (uf.length) {
      this.ibgeService
        .getMunicipiosByEstado(uf)
        .pipe(take(1))
        .subscribe((municipios) => {
          this.municipios = municipios;
          this.devFormRegister.get('cidade').enable();
        });
    }
  }

  public onSubmit(): void {
    if (this.devFormRegister.invalid) {
      alert('Por favor, verifique os campos obrigatórios.');
      return;
    }
    this.dev = this.devFormRegister.value as Dev;

    this.ibgeService
      .getEstadoByUf((this.dev.estado).toString())
      .pipe(take(1))
      .subscribe((ibgeUf) => {
        this.dev.estado = ibgeUf;

        this.ibgeService
          .getMunicipioById((this.dev.cidade).toString())
          .pipe(take(1))
          .subscribe((ibgeMunicipio) => {
            this.dev.cidade = ibgeMunicipio;

            if (this.dev.id) {
              this.updateDev(this.dev);
            } else {
              this.createDev(this.dev);
            }
          });
      });
  }

  private createDev(dev: Dev): void {
    this.dev = this.devService.create(dev);
    if (this.dev) {
      alert(`Dev ${this.dev.nome} cadastrado(a) com sucesso.`);
      this.formReset();
    } else {
      alert('Dev com E-mail ou usuário do GitHub já cadastrado(a).');
    }
  }

  private updateDev(dev: Dev): void {
    this.dev = this.devService.update(dev);
    alert(`Dev ${this.dev.nome} alterado com sucesso.`);
    this.loadDev(this.dev);
  }

  private formReset(): void {
    this.devFormRegister.reset();
    this.createForm();
    this.getFormacoesAcademicas();
    this.getEstados();
  }
}