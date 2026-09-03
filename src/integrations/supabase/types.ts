export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      user_profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bot_empreendimentos_semanal: {
        Args: { p_enviar?: boolean }
        Returns: string
      }
      cobrancas_bootstrap_profile: { Args: never; Returns: Json }
      cobrancas_current_uid: { Args: never; Returns: string }
      cobrancas_dedup: {
        Args: never
        Returns: {
          grupos: number
          removidos: number
        }[]
      }
      cobrancas_is_admin: { Args: never; Returns: boolean }
      cobrancas_is_member: { Args: never; Returns: boolean }
      cobrancas_norm: { Args: { _txt: string }; Returns: string }
      cobrancas_sync_sienge: {
        Args: never
        Returns: {
          atualizados: number
          inseridos: number
          reabertos: number
        }[]
      }
      comissoes_consultor_vendas: {
        Args: { p_from: string; p_responsavel: string; p_to: string }
        Returns: {
          faixa_de: number
          faturamento: number
          pct_base: number
          valor: number
          vendas: number
        }[]
      }
      comissoes_is_admin: { Args: { uid?: string }; Returns: boolean }
      comissoes_pingo_candidatos: {
        Args: { p_dias?: number; p_primeiro_nome?: string; p_vendedor?: string }
        Returns: {
          cliente_nome: string
          data_vendido: string
          empreendimento: string
          id: string
          ja_vinculado: string[]
          numero_lote: string
          preco_lote: number
          vendedor: string
        }[]
      }
      contas_pagas_aprender_classificacao: {
        Args: { p_dominancia?: number; p_minimo?: number }
        Returns: number
      }
      contas_pagas_aprendizado_para_conferencia: { Args: never; Returns: Json }
      contas_pagas_avulsos_com_titulo_aberto: {
        Args: { p_ate?: string; p_de?: string }
        Returns: Json
      }
      contas_pagas_cota_bulk: {
        Args: { p_limite?: number }
        Returns: {
          limite: number
          restantes: number
          usadas: number
        }[]
      }
      contas_pagas_gatilho_valido: {
        Args: { p_token: string }
        Returns: boolean
      }
      contas_pagas_idade_do_espelho: {
        Args: never
        Returns: {
          horas: number
          recurso: string
          registros: number
          ultimo_ok: string
        }[]
      }
      contas_pagas_marcar_ausentes: {
        Args: { p_janela_ate: string; p_janela_de: string; p_sync_id: number }
        Returns: number
      }
      contas_pagas_parcelas_para_conferencia: {
        Args: {
          p_dias_quitadas?: number
          p_empresas?: number[]
          p_venc_ate?: string
          p_venc_de?: string
        }
        Returns: Json
      }
      contas_pagas_sync_abrir: {
        Args: {
          p_bulk?: boolean
          p_disparado_por?: string
          p_janela_ate: string
          p_janela_de: string
          p_recurso: string
        }
        Returns: number
      }
      contas_pagas_sync_contas: {
        Args: { p_dados: Json; p_sync_id: number }
        Returns: number
      }
      contas_pagas_sync_credores: {
        Args: { p_dados: Json; p_sync_id: number }
        Returns: number
      }
      contas_pagas_sync_fechar: {
        Args: {
          p_bytes?: number
          p_erro?: string
          p_registros?: number
          p_status: string
          p_sync_id: number
        }
        Returns: undefined
      }
      contas_pagas_sync_movimentos: {
        Args: {
          p_dados: Json
          p_janela_ate: string
          p_janela_de: string
          p_sync_id: number
        }
        Returns: number
      }
      contas_pagas_sync_parcelas: {
        Args: {
          p_dados: Json
          p_janela_ate: string
          p_janela_de: string
          p_marcar_ausentes?: boolean
          p_sync_id: number
        }
        Returns: {
          gravadas: number
          sumiram: number
        }[]
      }
      contas_pagas_trilha_abrir: {
        Args: {
          p_arquivos: string[]
          p_maquina: string
          p_periodo_ate: string
          p_periodo_de: string
          p_total_centavos: number
          p_total_lancamentos: number
          p_usuario: string
        }
        Returns: number
      }
      contas_pagas_trilha_evento: {
        Args: {
          p_execucao_id: number
          p_payload?: Json
          p_proposta_id?: number
          p_tipo: string
          p_usuario?: string
        }
        Returns: number
      }
      contas_pagas_trilha_fechar: {
        Args: { p_execucao_id: number; p_observacao?: string; p_status: string }
        Returns: undefined
      }
      contas_pagas_trilha_lancamento: {
        Args: { p_execucao_id: number; p_lancamento: Json; p_propostas?: Json }
        Returns: Json
      }
      crm_auditoria: {
        Args: { p_from: string; p_to: string }
        Returns: {
          nome: string
          responsavel_id: string
          sla_conforme: number
          sla_inconforme: number
          sla_no_prazo: number
          sla_total: number
          visitas_outbound: number
          visitas_realizadas: number
        }[]
      }
      crm_auditoria_leads: {
        Args: { p_from: string; p_responsavel: string; p_to: string }
        Returns: {
          chegada: string
          cliente_nome: string
          conforme: boolean
          deal_id: string
          minutos: number
          primeira_acao: string
          teve_acao: boolean
        }[]
      }
      crm_auditoria_resumo: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      crm_auditoria_semanal: {
        Args: { p_from: string; p_to: string }
        Returns: {
          dias: number
          meta_outbound: number
          meta_visitas: number
          nome: string
          outbound: number
          responsavel_id: string
          semana_ini: string
          semana_num: number
          visitas: number
        }[]
      }
      crm_busca_contatos: {
        Args: { p_q: string }
        Returns: {
          cliente_nome: string
          deal_id: string
          empreendimento_nome: string
          telefone: string
        }[]
      }
      crm_ciclo_semanas: {
        Args: { p_from: string; p_to: string }
        Returns: {
          dias: number
          fim: string
          ini: string
          num: number
        }[]
      }
      crm_comissao: {
        Args: {
          p_aud_from: string
          p_aud_to: string
          p_fat_from: string
          p_fat_to: string
        }
        Returns: Json
      }
      crm_consultores_com_deals: {
        Args: never
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      crm_dashboard_counts: {
        Args: {
          p_emp?: string
          p_from: string
          p_to: string
          p_users?: string[]
        }
        Returns: Json
      }
      crm_deal_por_telefone: {
        Args: { p_tel: string }
        Returns: {
          cliente_nome: string
          deal_id: string
          empreendimento_nome: string
          status: string
          telefone: string
        }[]
      }
      crm_eh_outbound: {
        Args: { p_quando: string; p_tipo: string }
        Returns: boolean
      }
      crm_esta_admin: { Args: never; Returns: boolean }
      crm_esta_autorizado: { Args: never; Returns: boolean }
      crm_get_all_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["crm_app_role"]
        }[]
      }
      crm_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["crm_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      crm_is_active: { Args: { _user_id: string }; Returns: boolean }
      crm_meta_set: {
        Args: { p_escopo: string; p_mes: string; p_meta: number; p_ref: string }
        Returns: undefined
      }
      crm_metas_progresso: {
        Args: { p_mes: string }
        Returns: {
          escopo: string
          meta_vendas: number
          nome: string
          realizado: number
          ref_id: string
        }[]
      }
      crm_minutos_comerciais: {
        Args: { p_fim: string; p_inicio: string }
        Returns: number
      }
      crm_nomes_por_telefones: {
        Args: { p_tels: string[] }
        Returns: {
          cliente_nome: string
          sufixo: string
        }[]
      }
      crm_registra_atividade_whats: {
        Args: { p_deal: string; p_user: string }
        Returns: undefined
      }
      crm_relatorio_vendas: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cliente_nome: string
          created_at: string
          data_perdido: string
          data_vendido: string
          empreendimento_id: string
          fonte_id: string
          fonte_original: string
          forma_pagamento: string
          id: string
          numero_lote: string
          preco_lote: number
          responsavel_id: string
          responsavel_venda_corretor_id: string
          responsavel_venda_original: string
          responsavel_venda_user_id: string
          status: string
          utm_campaign: string
          valor_entrada: number
        }[]
      }
      crm_sla_fora: {
        Args: { p_created_at: string; p_deal_id: string }
        Returns: boolean
      }
      crm_tirar_resquicio_venda: {
        Args: { p_deal_id: string; p_vendido_em?: string }
        Returns: Json
      }
      crm_transferir_responsavel: {
        Args: { p_deal_id: string; p_novo_responsavel: string }
        Returns: undefined
      }
      crm_vendas_notif_diaria: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cliente: string
          corretor: string
          dono: string
          empreendimento: string
          lote: string
          valor: number
          vendido_em: string
        }[]
      }
      crm_vendas_notif_hora: {
        Args: never
        Returns: {
          cliente: string
          corretor: string
          deal_id: string
          dono: string
          empreendimento: string
          link_contrato: string
          lote: string
          valor: number
          vendido_em: string
        }[]
      }
      crm_vendas_notif_marcar: { Args: { p_ids: string[] }; Returns: number }
      crm_vendas_periodo: {
        Args: {
          p_emp?: string
          p_from: string
          p_to: string
          p_users?: string[]
        }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "crm_deals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crm_vendas_por_empreendimento: {
        Args: { p_from: string; p_to: string }
        Returns: {
          consultor: string
          crm_deal_id: string
          empreendimento: string
          externa: boolean
          numero_lote: string
          preco_lote: number
          responsavel_id: string
        }[]
      }
      crm_vendas_sem_contrato: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      enriquecer_deals: { Args: { p_data: Json }; Returns: Json }
      esquadro_aprovar_solicitacao: {
        Args: { p_id: string; p_role: string }
        Returns: undefined
      }
      esquadro_authorize_user: {
        Args: { p_email: string; p_role: string }
        Returns: {
          email: string
          nome: string
          user_id: string
        }[]
      }
      esquadro_is_member: { Args: never; Returns: boolean }
      esquadro_recusar_solicitacao: {
        Args: { p_id: string }
        Returns: undefined
      }
      esquadro_registrar_solicitacao_acesso: { Args: never; Returns: undefined }
      export_all_deals: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      export_deals_empreendimento: {
        Args: never
        Returns: {
          cliente_nome: string
          empreendimento_id: string
          empreendimento_nome: string
          id: string
          numero_lote: string
          preco_lote: number
          status: string
          versao_tabela: string
        }[]
      }
      fechamento_claim_envio: {
        Args: {
          p_chave: string
          p_janela_min?: number
          p_periodo: string
          p_tipo: string
        }
        Returns: boolean
      }
      fmt_bar: { Args: { n?: number; p: number }; Returns: string }
      fmt_brl: { Args: { v: number }; Returns: string }
      fmt_horas: { Args: { h: number }; Returns: string }
      fn_norm_lote: { Args: { p: string }; Returns: string }
      frota_aprovar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      frota_authorize_user: {
        Args: { p_email: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      frota_has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      frota_meu_acesso: { Args: never; Returns: Json }
      frota_recusar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      frota_registrar_solicitacao_acesso: { Args: never; Returns: undefined }
      get_all_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_dados_contrato: { Args: { p_bill_id: number }; Returns: Json }
      get_eap_avanco_sums: {
        Args: { p_obra_id?: string }
        Returns: {
          eap_item_id: string
          sum_quantidade_dia: number
        }[]
      }
      get_empreendimentos: {
        Args: never
        Returns: {
          enterprise_name: string
        }[]
      }
      get_empresas_abertas: {
        Args: never
        Returns: {
          company_id: number
          company_name: string
        }[]
      }
      get_mapa_lotes: { Args: never; Returns: Json }
      get_status_lote: {
        Args: { p_nome: string; p_num: string }
        Returns: string
      }
      get_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
          nome: string
        }[]
      }
      get_valor_pago: { Args: { p_bill_id: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_anotacoes: {
        Args: { dados: Json }
        Returns: {
          inserted: number
          matched: number
          no_match: number
          skipped: number
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      licenciamento_add_comentario_etapa: {
        Args: { p_conteudo: string; p_etapa_id: string }
        Returns: undefined
      }
      licenciamento_add_impugnacao_etapa: {
        Args: { p_data?: string; p_descricao: string; p_etapa_id: string }
        Returns: string
      }
      licenciamento_aprovar_acesso: {
        Args: { p_id: string }
        Returns: undefined
      }
      licenciamento_aprovar_arquivo: {
        Args: { p_aprovado: boolean; p_arquivo_id: string }
        Returns: undefined
      }
      licenciamento_bootstrap: { Args: never; Returns: Json }
      licenciamento_criar_empreendimento: {
        Args: { p_nome: string }
        Returns: string
      }
      licenciamento_criar_tipo_projeto: {
        Args: { p_nome: string }
        Returns: string
      }
      licenciamento_demandas_vinculaveis: {
        Args: { p_empreendimento_id: string }
        Returns: {
          data_solicitacao: string
          id: string
          ja_vinculada: boolean
          status: string
          tipo_projeto: string
        }[]
      }
      licenciamento_desvincular_demanda: {
        Args: { p_etapa_id: string }
        Returns: undefined
      }
      licenciamento_esta_autorizado: { Args: { uid: string }; Returns: boolean }
      licenciamento_excluir_comentario_etapa: {
        Args: { p_comentario_id: string; p_etapa_id: string }
        Returns: undefined
      }
      licenciamento_has_papel: {
        Args: {
          p_papel: Database["public"]["Enums"]["licenciamento_papel"]
          uid: string
        }
        Returns: boolean
      }
      licenciamento_impugnacoes_pendentes: { Args: never; Returns: number }
      licenciamento_is_admin: { Args: { uid: string }; Returns: boolean }
      licenciamento_listar_comentarios_etapa: {
        Args: { p_etapa_id: string }
        Returns: {
          autor: string
          conteudo: string
          created_at: string
          id: string
          origem: string
          pode_excluir: boolean
        }[]
      }
      licenciamento_listar_impugnacoes_etapa: {
        Args: { p_etapa_id: string }
        Returns: {
          data: string
          descricao: string
          id: string
          origem: string
        }[]
      }
      licenciamento_meu_profile_id: { Args: never; Returns: string }
      licenciamento_recusar_acesso: {
        Args: { p_id: string }
        Returns: undefined
      }
      licenciamento_resumo_diario_chat: {
        Args: { p_data?: string }
        Returns: {
          arquivos: Json
          data_br: string
          texto: string
        }[]
      }
      licenciamento_set_tipo_ativo: {
        Args: { p_ativo: boolean; p_id: string }
        Returns: undefined
      }
      licenciamento_sync_status_esquadro: { Args: never; Returns: number }
      licenciamento_ver_demanda: {
        Args: { p_etapa_id: string }
        Returns: {
          data_solicitacao: string
          demanda_id: string
          empreendimento: string
          instrucoes: string
          prazo: string
          prioridade: number
          status: string
          tipo_projeto: string
        }[]
      }
      licenciamento_vincular_demanda: {
        Args: { p_copiar?: boolean; p_demanda_id: string; p_etapa_id: string }
        Returns: undefined
      }
      paver_aprovar_solicitacao: {
        Args: { p_id: string; p_role: string }
        Returns: undefined
      }
      paver_authorize_user: {
        Args: { p_email: string; p_role: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      paver_has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      paver_recusar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      paver_registrar_solicitacao_acesso: { Args: never; Returns: undefined }
      perdigueiro_esta_admin: { Args: never; Returns: boolean }
      perdigueiro_esta_autorizado: { Args: never; Returns: boolean }
      posicao_caixa_dados: { Args: { p_date?: string }; Returns: Json }
      posicao_caixa_is_admin: { Args: never; Returns: boolean }
      posicao_caixa_is_member: { Args: never; Returns: boolean }
      posicao_caixa_sync_upsert: {
        Args: { p_contas: Json; p_saldos: Json }
        Returns: Json
      }
      posicao_caixa_valid_cron: { Args: { t: string }; Returns: boolean }
      posvenda_contratos_vencendo: {
        Args: { p_dias?: number }
        Returns: {
          empreendimento: string
          lote: string
          nome_cliente: string
          vencimento_data: string
        }[]
      }
      posvenda_contratos_vencidos: {
        Args: never
        Returns: {
          empreendimento: string
          lote: string
          nome_cliente: string
          vencimento_data: string
        }[]
      }
      public_submit_candidate: { Args: { candidate_data: Json }; Returns: Json }
      registros_calcular_valor_pago: {
        Args: {
          p_contract_number: string
          p_enterprise_id: number
          p_lote_numero: string
        }
        Returns: number
      }
      registros_em_andamento_count: { Args: never; Returns: number }
      registros_extrair_numero_com_letra: {
        Args: { input: string }
        Returns: string
      }
      registros_extrair_numero_lote: {
        Args: { input: string }
        Returns: string
      }
      registros_get_lotes_without_registros: {
        Args: never
        Returns: {
          empreendimento_id: number
          id: number
          numero: string
        }[]
      }
      registros_manutencao_diaria: { Args: never; Returns: Json }
      registros_refresh_valor_pago: { Args: never; Returns: undefined }
      rh_aprovar_alternativa: { Args: { p_id: string }; Returns: undefined }
      rh_aprovar_auditoria: {
        Args: { p_aprovar: boolean; p_auditoria_id: string; p_motivo?: string }
        Returns: undefined
      }
      rh_auditor_em_equipe: {
        Args: { _equipe_id: string; _uid: string }
        Returns: boolean
      }
      rh_criar_auditoria: {
        Args: {
          p_data_referencia?: string
          p_equipe_id: string
          p_titulo: string
        }
        Returns: string
      }
      rh_current_funcionario_id: { Args: never; Returns: string }
      rh_duplicar_grupo_atividades_auditoria: {
        Args: { _grupo_id: string }
        Returns: string
      }
      rh_fechar_auditoria: { Args: { p_auditoria_id: string }; Returns: number }
      rh_get_all_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          funcionario_id: string
          funcionario_nome: string
          id: string
          is_auditor: boolean
          nome: string
          role: Database["public"]["Enums"]["rh_app_role"]
          status: string
        }[]
      }
      rh_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["rh_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rh_is_auditor: { Args: { _uid: string }; Returns: boolean }
      rh_is_staff: { Args: never; Returns: boolean }
      rh_list_funcionarios_para_vinculo: {
        Args: never
        Returns: {
          cpf_masked: string
          id: string
          nome_completo: string
        }[]
      }
      rh_listar_atividades_auditoria: {
        Args: never
        Returns: {
          ativo: boolean
          created_at: string
          criterio_proficiencia: string
          equipe_id: string
          grupo_id: string
          grupo_nome: string
          grupo_ordem: number
          grupo_peso: number
          id: string
          indicadores: string
          manuais: string
          metodo_auditoria: string
          nome: string
          normas: string
          ordem: number
          peso: number
          responsavel_funcionario_id: string
          updated_at: string
        }[]
      }
      rh_reabrir_auditoria: {
        Args: { p_auditoria_id: string }
        Returns: undefined
      }
      rh_revogar_alternativa: { Args: { p_id: string }; Returns: undefined }
      rh_set_my_funcionario: {
        Args: { p_funcionario_id: string }
        Returns: undefined
      }
      rh_solicitar_acesso: {
        Args: { p_funcionario_id: string; p_is_auditor?: boolean }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      simulador_esta_admin: { Args: never; Returns: boolean }
      simulador_esta_autorizado: { Args: never; Returns: boolean }
      simulador_pode_gerenciar: { Args: never; Returns: boolean }
      simulador_solicitar_acesso: { Args: { p_nome?: string }; Returns: string }
      talents_aprovar_solicitacao: {
        Args: { p_id: string; p_role: string }
        Returns: undefined
      }
      talents_authorize_user: {
        Args: { p_email: string; p_role: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      talents_has_privileged_role: {
        Args: { p_min_role: string }
        Returns: boolean
      }
      talents_has_staff_access: { Args: never; Returns: boolean }
      talents_is_admin: { Args: never; Returns: boolean }
      talents_is_developer: { Args: never; Returns: boolean }
      talents_is_editor_or_admin: { Args: never; Returns: boolean }
      talents_list_cargos: {
        Args: never
        Returns: {
          id: string
          nome: string
          trilha: string
        }[]
      }
      talents_recusar_solicitacao: {
        Args: { p_id: string }
        Returns: undefined
      }
      talents_registrar_solicitacao_acesso: { Args: never; Returns: undefined }
      talents_resumo_candidatos_semana: {
        Args: { p_dias?: number }
        Returns: Json
      }
      update_corretor_cadastro_completo: {
        Args: {
          p_bairro?: string
          p_banco_agencia?: string
          p_banco_chave_pix?: string
          p_banco_conta?: string
          p_banco_nome?: string
          p_banco_tipo?: string
          p_cep?: string
          p_cidade?: string
          p_cnpj?: string
          p_cpf?: string
          p_creci?: string
          p_email?: string
          p_email_secundario?: string
          p_endereco?: string
          p_id: string
          p_nome_exibicao?: string
          p_razao_social?: string
          p_telefone?: string
          p_tipo?: string
          p_uf?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      cobrancas_acao_tipo: "realizada" | "agendada"
      cobrancas_empreendimento:
        | "Aurora"
        | "Erico Verissimo"
        | "Morada da Coxilha"
        | "Algarve"
        | "Montecarlo"
        | "Ilha dos Açores"
        | "Lorena 1"
        | "Lorena 2"
        | "Jardim do Parque"
      cobrancas_responsavel: "Gabrielle" | "Antonio" | "Lais" | "Suelen"
      cobrancas_role: "admin" | "comum"
      crm_app_role: "admin" | "user" | "gestor" | "recuperacao"
      crm_deal_status:
        | "lead_recebido"
        | "contato_feito"
        | "visita_agendada"
        | "visita_realizada"
        | "ficha_assinada"
        | "proposta_recebida"
        | "perdido"
        | "vendido"
      crm_qualificacao: "frio" | "morno" | "quente"
      frota_app_role: "admin"
      gleba_status:
        | "identificada"
        | "informacoes_recebidas"
        | "visita_realizada"
        | "proposta_enviada"
        | "protocolo_assinado"
        | "descartada"
        | "proposta_recusada"
        | "negocio_fechado"
        | "standby"
        | "analise_interna_realizada"
        | "minuta_enviada"
      licenciamento_categoria_arquivo:
        | "sem_tipo"
        | "protocolo"
        | "impugnacao"
        | "aprovacao"
      licenciamento_papel: "admin" | "comum"
      licenciamento_status_etapa:
        | "concluido"
        | "em_desenvolvimento_interno"
        | "em_desenvolvimento_externo"
        | "em_analise_interno"
        | "em_analise_externo"
        | "aguardando_outra_etapa"
      licenciamento_status_tarefa: "programada" | "concluida"
      paver_app_role: "admin" | "engenharia"
      permuta_status: "incerto" | "nao" | "sim"
      registros_user_role: "gestor" | "operador" | "leitor"
      rh_app_role:
        | "admin"
        | "coordenador"
        | "usuario"
        | "colaborador"
        | "auditor"
      rh_auditoria_item_status:
        | "pendente"
        | "positivo"
        | "inconformidade"
        | "nao_aplica"
      rh_auditoria_status:
        | "em_andamento"
        | "finalizada"
        | "aprovada"
        | "rejeitada"
      tipo_anexo_gleba:
        | "pesquisa_mercado"
        | "planilha_viabilidade"
        | "matricula_imovel"
      tipo_proposta: "compra" | "parceria" | "mista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      cobrancas_acao_tipo: ["realizada", "agendada"],
      cobrancas_empreendimento: [
        "Aurora",
        "Erico Verissimo",
        "Morada da Coxilha",
        "Algarve",
        "Montecarlo",
        "Ilha dos Açores",
        "Lorena 1",
        "Lorena 2",
        "Jardim do Parque",
      ],
      cobrancas_responsavel: ["Gabrielle", "Antonio", "Lais", "Suelen"],
      cobrancas_role: ["admin", "comum"],
      crm_app_role: ["admin", "user", "gestor", "recuperacao"],
      crm_deal_status: [
        "lead_recebido",
        "contato_feito",
        "visita_agendada",
        "visita_realizada",
        "ficha_assinada",
        "proposta_recebida",
        "perdido",
        "vendido",
      ],
      crm_qualificacao: ["frio", "morno", "quente"],
      frota_app_role: ["admin"],
      gleba_status: [
        "identificada",
        "informacoes_recebidas",
        "visita_realizada",
        "proposta_enviada",
        "protocolo_assinado",
        "descartada",
        "proposta_recusada",
        "negocio_fechado",
        "standby",
        "analise_interna_realizada",
        "minuta_enviada",
      ],
      licenciamento_categoria_arquivo: [
        "sem_tipo",
        "protocolo",
        "impugnacao",
        "aprovacao",
      ],
      licenciamento_papel: ["admin", "comum"],
      licenciamento_status_etapa: [
        "concluido",
        "em_desenvolvimento_interno",
        "em_desenvolvimento_externo",
        "em_analise_interno",
        "em_analise_externo",
        "aguardando_outra_etapa",
      ],
      licenciamento_status_tarefa: ["programada", "concluida"],
      paver_app_role: ["admin", "engenharia"],
      permuta_status: ["incerto", "nao", "sim"],
      registros_user_role: ["gestor", "operador", "leitor"],
      rh_app_role: [
        "admin",
        "coordenador",
        "usuario",
        "colaborador",
        "auditor",
      ],
      rh_auditoria_item_status: [
        "pendente",
        "positivo",
        "inconformidade",
        "nao_aplica",
      ],
      rh_auditoria_status: [
        "em_andamento",
        "finalizada",
        "aprovada",
        "rejeitada",
      ],
      tipo_anexo_gleba: [
        "pesquisa_mercado",
        "planilha_viabilidade",
        "matricula_imovel",
      ],
      tipo_proposta: ["compra", "parceria", "mista"],
    },
  },
} as const
