import la_pluma as L, numpy as np
def tvs_snub(d, t0, t1):
    t=d['time']; m=(t>t0)&(t<t1); T=t1-t0
    p_tvs=np.trapezoid(np.where(m,(d['v(dr)']-d['v(sw)'])*(-d['i(vtv)']),0),t)/T
    p_sn=np.trapezoid(np.where(m,(d['v(sw)']-d['v(sn1)'])**2/3.3,0),t)/T
    return p_tvs, p_sn, (-d['i(vtv)'][m]).max()
for name, over, scen, tr, win in [
    ("E_continuo_46A", dict(DETECT=0, ISET=46.0, TEND=4e-3), L.CONT, 1.0, (2.6e-3,3.4e-3)),
    ("E_sinTVS_46A", dict(DETECT=0, ISET=46.0, TEND=4e-3, TVS=0), L.CONT, 1.0, (2.6e-3,3.4e-3)),
    ("G_pluma_90A_Q3", dict(DMAX=0.22, DETECT=1, USEQ3=1, ISET=90.0), L.DOT, L.T_RUPT, (2.6e-3,3.4e-3)),
    ("G0_pluma_90A_sinQ3", dict(DMAX=0.22, DETECT=1, USEQ3=0, ISET=90.0), L.DOT, L.T_RUPT, (2.6e-3,3.4e-3)),
    ("G_RGOFF68_90A", dict(DMAX=0.22, DETECT=1, USEQ3=1, ISET=90.0, RGOFF=68), L.DOT, L.T_RUPT, (2.6e-3,3.4e-3)),
]:
    p=dict(L.BASE); p.update(over)
    d=L.run(name,p,scen,tr); rows=[]; L.report(name,d,tr,rows); r=rows[0]
    pt,ps,itv=tvs_snub(d,*win)
    vds=d['v(dr)']-d['v(sw)']
    print(f"{name:20s} I={r[3]:5.1f}A Vds_max={vds.max():6.1f} SWmin={d['v(sw)'].min():6.1f} P_TVS={pt:5.2f}W I_TVS_pico={itv:5.1f}A P_snubber={ps:4.2f}W P_Q1={r[14]:5.1f}W P_D1={r[15]:5.1f}W E_arco={r[12]*1e3:5.1f}mJ I_puente@rupt={r[10]:5.1f} I_Q3max={r[18]:5.1f} Vbs_max={(d['v(vb)']-d['v(sw)']).max():5.2f}")
