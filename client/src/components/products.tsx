"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { addGuestCartItem } from "@/lib/guest-cart";
import type { Category, PageResult, Product, ProductVariant, Review } from "@/lib/types";
import { useStore } from "./providers";
import { Breadcrumb, Button, EmptyState, ErrorState, Loading, Pagination, Price, ProductImage, Rating, SectionHeading } from "./ui";

export function ProductCard({ product }: { product: Product }) {
  const { user, refreshCart, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const variant = product.variants?.find((item) => item.status === "ACTIVE") ?? null;

  async function addToCart(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!variant) {
      notify("Sản phẩm chưa có phiên bản đang bán.", "error");
      return;
    }
    setBusy(true);
    try {
      if (!user) {
        addGuestCartItem({
          variant_id: variant.id,
          quantity: 1,
          variant_name: variant.name,
          sku: variant.sku,
          price: variant.price,
          product_id: product.id,
          product_name: product.name,
          slug: product.slug,
          available_quantity: 999,
          primary_image: product.primary_image,
        });
        await refreshCart();
        notify("Đã thêm sản phẩm vào giỏ hàng.");
      } else {
        await api.addCartItem(variant.id, 1);
        await refreshCart();
        notify("Đã thêm sản phẩm vào giỏ hàng.");
      }
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Không thể thêm vào giỏ hàng.", "error");
    } finally {
      setBusy(false);
    }
  }

  const price = variant?.price ?? product.starting_price;
  return (
    <article className="product-card">
      <Link className="product-card__image-link" href={`/san-pham/${encodeURIComponent(product.slug)}`}>
        <ProductImage src={product.primary_image} alt={product.name} className="product-card__image" />
      </Link>
      <div className="product-card__body">
        {product.category_name && <p className="product-card__category">{product.category_name}</p>}
        <h3><Link href={`/san-pham/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h3>
        {product.short_description && <p className="product-card__description">{product.short_description}</p>}
        <div className="product-card__meta">
          <Price value={price} comparePrice={variant?.compare_price} />
          {product.rating && <Rating value={product.rating.average_rating} count={product.rating.review_count} />}
        </div>
        <div className="product-card__actions">
          <Button href={`/san-pham/${encodeURIComponent(product.slug)}`} variant="secondary">Xem chi tiết</Button>
          <button type="button" className="icon-button add-cart-button" onClick={addToCart} disabled={busy || !variant} aria-label={`Thêm ${product.name} vào giỏ`}>
            {busy ? "…" : "＋"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <EmptyState title="Chưa có sản phẩm" description="Sản phẩm sẽ hiển thị tại đây khi được cập nhật." />;
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

function useProductPage(params: { page: number; search?: string; category?: string; sort: string }) {
  const { category, page, search, sort } = params;
  const [result, setResult] = useState<PageResult<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await api.products({ page, search, category, sort, limit: 12 }));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [category, page, search, sort]);
  useEffect(() => { void load(); }, [load]);
  return { result, loading, error, retry: load };
}

export function ProductListing() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const sort = searchParams.get("sort") ?? "newest";
  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const { result, loading, error, retry } = useProductPage({ page, search, category: category || undefined, sort });

  useEffect(() => { setSearchInput(search); }, [search]);
  useEffect(() => {
    let active = true;
    void api.categories().then((response) => {
      if (active) setCategories(response.data);
    }).catch(() => {
      if (active) setCategoryError(true);
    });
    return () => { active = false; };
  }, []);

  function navigate(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    router.push(`/san-pham${params.size ? `?${params}` : ""}`);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ search: searchInput.trim() || undefined, page: 1 });
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm" }]} />
      <section className="page-heading page-heading--catalog">
        <div><p className="eyebrow">Danh mục sản phẩm</p><h1>Sản phẩm</h1><p>Khám phá các sản phẩm đang được chủ thương hiệu cập nhật.</p></div>
      </section>
      <section className="catalog-toolbar" aria-label="Tìm kiếm và lọc sản phẩm">
        <form className="catalog-search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="catalog-search">Tìm sản phẩm</label>
          <input id="catalog-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo tên sản phẩm…" />
          <button className="button button--primary" type="submit">Tìm kiếm</button>
          {searchInput && <button className="button button--quiet" type="button" onClick={() => { setSearchInput(""); navigate({ search: undefined, page: 1 }); }}>Xóa</button>}
        </form>
        <div className="catalog-filters">
          <label>Danh mục
            <select value={category} onChange={(event) => navigate({ category: event.target.value || undefined, page: 1 })}>
              <option value="">Tất cả danh mục</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label>Sắp xếp
            <select value={sort} onChange={(event) => navigate({ sort: event.target.value, page: 1 })}>
              <option value="newest">Mới nhất</option>
              <option value="name_asc">Tên A–Z</option>
              <option value="price_asc">Giá thấp đến cao</option>
              <option value="price_desc">Giá cao đến thấp</option>
            </select>
          </label>
        </div>
        {categoryError && <p className="form-note">Chưa tải được danh mục; bạn vẫn có thể xem tất cả sản phẩm.</p>}
      </section>
      {loading ? <div className="product-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton product-skeleton" key={index} />)}</div>
        : error ? <ErrorState message={error} onRetry={() => void retry()} />
          : result?.data.length ? <ProductGrid products={result.data} />
            : <EmptyState title={search ? "Không tìm thấy sản phẩm" : "Chưa có sản phẩm"} description={search ? "Thử từ khóa khác hoặc xóa bộ lọc để xem thêm." : "Danh sách sẽ hiển thị khi chủ thương hiệu cập nhật sản phẩm."} action={search && <Button variant="secondary" href="/san-pham">Xóa bộ lọc</Button>} />}
      {result && !loading && !error && (
        <Pagination page={result.meta.page} limit={result.meta.limit} total={result.meta.total} onChange={(nextPage) => navigate({ page: nextPage })} />
      )}
    </main>
  );
}

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api.products({ page: 1, limit: 4, sort: "newest" }).then((result) => {
      if (active) setProducts(result.data);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải sản phẩm.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  return (
    <section className="section container">
      <div className="section-heading-row">
        <SectionHeading eyebrow="Từ danh mục sản phẩm" title="Sản phẩm" description="Danh sách được tải trực tiếp từ hệ thống cửa hàng." />
        <Button href="/san-pham" variant="secondary">Xem tất cả <span aria-hidden="true">→</span></Button>
      </div>
      {loading ? <div className="product-grid">{Array.from({ length: 4 }, (_, i) => <div className="skeleton product-skeleton" key={i} />)}</div>
        : error ? <ErrorState message={error} onRetry={() => { setError(""); setRetryKey((value) => value + 1); }} />
          : products.length ? <ProductGrid products={products} />
            : <EmptyState title="Danh mục đang được cập nhật" description="Sản phẩm sẽ xuất hiện tại đây khi có dữ liệu chính thức." action={<Button href="/san-pham" variant="secondary">Xem danh mục</Button>} />}
    </section>
  );
}

export function CategorySection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api.categories().then((result) => {
      if (active) setCategories(result.data);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải danh mục.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <section className="section section--soft"><div className="container"><Loading label="Đang tải danh mục…" /></div></section>;
  if (error || !categories.length) return null;
  return (
    <section className="section section--soft">
      <div className="container">
        <SectionHeading eyebrow="Lựa chọn theo danh mục" title="Danh mục sản phẩm" />
        <div className="category-list">{categories.map((category) => (
          <Link className="category-chip" key={category.id} href={`/san-pham?category=${encodeURIComponent(category.slug)}`}>
            <span className="category-chip__mark" aria-hidden="true">✳</span>{category.name}<span aria-hidden="true">↗</span>
          </Link>
        ))}</div>
      </div>
    </section>
  );
}

export function VideoSection() {
  const [videos, setVideos] = useState<Array<{ id: number; title: string; description: string | null; video_url: string; thumbnail_url: string | null }>>([]);
  useEffect(() => {
    let active = true;
    void api.videos().then((result) => {
      if (active) setVideos(result.data);
    }).catch(() => {
      if (active) setVideos([]);
    });
    return () => { active = false; };
  }, []);
  const current = videos[0];
  const embed = current ? youtubeEmbed(current.video_url) : null;
  return (
    <section className="section video-section">
      <div className="container video-section__inner">
        <div>
          <p className="eyebrow">Video giới thiệu</p>
          <h2>Câu chuyện qua hình ảnh</h2>
          <p>{current?.description || "Video giới thiệu sẽ được cập nhật khi chủ thương hiệu cung cấp nội dung chính thức."}</p>
        </div>
        {current && embed ? (
          <div className="video-frame">
            <iframe src={embed} title={current.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </div>
        ) : (
          <div className="video-placeholder" aria-label="Video giới thiệu đang chờ chủ thương hiệu cung cấp">
            <span className="video-placeholder__play" aria-hidden="true">▶</span>
            <span>Video giới thiệu sẽ được cập nhật.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function youtubeEmbed(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.slice(1);
    else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
      else if (url.pathname.startsWith("/embed/")) videoId = url.pathname.slice("/embed/".length);
      else if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.slice("/shorts/".length);
    }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export function BrandStory() {
  return (
    <section className="section brand-story">
      <div className="container brand-story__grid">
        <div className="brand-story__art" aria-hidden="true"><span>Nam Ô</span><small>HƯƠNG LÀNG CỔ</small></div>
        <div className="brand-story__copy">
          <p className="eyebrow">Câu chuyện thương hiệu</p>
          <h2>Giá trị Nam Ô, qua lời kể của chủ thương hiệu</h2>
          <p>Nội dung câu chuyện thương hiệu chính thức đang chờ chủ sở hữu cung cấp. Chúng tôi sẽ cập nhật tại đây, không tự suy diễn lịch sử hoặc quy trình sản xuất.</p>
          <Button href="/gioi-thieu" variant="secondary">Tìm hiểu thêm</Button>
        </div>
      </div>
    </section>
  );
}

export function ProductDetail({ initialProduct }: { initialProduct: Product }) {
  const router = useRouter();
  const { user, refreshCart, notify } = useStore();
  const [selected, setSelected] = useState<ProductVariant | null>(initialProduct.variants?.[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(
    initialProduct.images?.find((image) => image.is_primary)?.image_url ?? initialProduct.images?.[0]?.image_url ?? null,
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewError, setReviewError] = useState("");
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewPage, setReviewPage] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [related, setRelated] = useState<Product[]>([]);
  const [relatedError, setRelatedError] = useState("");
  const available = selected?.available_quantity;
  const outOfStock = selected ? selected.in_stock === false || selected.in_stock === 0 || available === 0 : true;

  const loadReviews = useCallback(async () => {
    setReviewLoading(true);
    setReviewError("");
    try {
      const response = await api.reviews(initialProduct.id, reviewPage);
      setReviews(response.data);
    } catch (error) {
      setReviewError(error instanceof ApiError ? error.message : "Không thể tải đánh giá.");
    } finally {
      setReviewLoading(false);
    }
  }, [initialProduct.id, reviewPage]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);
  useEffect(() => {
    let active = true;
    void api.relatedProducts(initialProduct.id).then((result) => {
      if (active) setRelated(result);
    }).catch(() => {
      if (active) setRelatedError("Chưa thể tải sản phẩm liên quan.");
    });
    return () => { active = false; };
  }, [initialProduct.id]);

  async function add(buyNow: boolean) {
    if (!selected || outOfStock) {
      notify("Phiên bản này hiện chưa có hàng.", "error");
      return;
    }
    setAddBusy(true);
    try {
      if (!user) {
        addGuestCartItem({
          variant_id: selected.id,
          quantity,
          variant_name: selected.name,
          sku: selected.sku,
          price: selected.price,
          product_id: initialProduct.id,
          product_name: initialProduct.name,
          slug: initialProduct.slug,
          available_quantity: selected.available_quantity ?? 999,
          primary_image: initialProduct.primary_image,
        });
        await refreshCart();
        if (buyNow) router.push("/gio-hang");
        else notify("Đã thêm sản phẩm vào giỏ hàng.");
      } else {
        await api.addCartItem(selected.id, quantity);
        await refreshCart();
        if (buyNow) router.push("/thanh-toan");
        else notify("Đã thêm sản phẩm vào giỏ hàng.");
      }
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Không thể thêm vào giỏ hàng.", "error");
    } finally {
      setAddBusy(false);
    }
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      router.push(`/dang-nhap?next=${encodeURIComponent(`/san-pham/${initialProduct.slug}`)}`);
      return;
    }
    setReviewBusy(true);
    try {
      await api.submitReview(initialProduct.id, { rating, comment: comment.trim() || undefined });
      setComment("");
      notify("Đánh giá đã gửi và đang chờ duyệt.");
      setReviewPage(1);
      await loadReviews();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Không thể gửi đánh giá.", "error");
    } finally {
      setReviewBusy(false);
    }
  }

  const images = initialProduct.images ?? [];
  return (
    <main className="page-shell container">
      <Breadcrumb items={[
        { label: "Trang chủ", href: "/" },
        { label: "Sản phẩm", href: "/san-pham" },
        ...(initialProduct.category_name ? [{ label: initialProduct.category_name, href: `/san-pham?category=${encodeURIComponent(initialProduct.category_slug ?? "")}` }] : []),
        { label: initialProduct.name },
      ]} />
      <section className="product-detail">
        <div className="product-gallery">
          <ProductImage src={activeImage ?? initialProduct.primary_image} alt={initialProduct.name} className="product-gallery__main" />
          {images.length > 1 && (
            <div className="product-gallery__thumbs" aria-label="Ảnh sản phẩm">
              {images.map((image) => (
                <button type="button" key={image.id} className={activeImage === image.image_url ? "is-selected" : ""} onClick={() => setActiveImage(image.image_url)} aria-label={image.alt_text || `Xem ảnh sản phẩm ${image.sort_order + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.image_url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <p className="eyebrow">{initialProduct.category_name || "Sản phẩm"}</p>
          <h1>{initialProduct.name}</h1>
          <Rating value={initialProduct.rating?.average_rating} count={initialProduct.rating?.review_count} />
          {initialProduct.short_description && <p className="product-info__intro">{initialProduct.short_description}</p>}
          <Price value={selected?.price ?? initialProduct.starting_price} comparePrice={selected?.compare_price} />
          {initialProduct.variants?.length ? (
            <fieldset className="variant-selector">
              <legend>Phiên bản sản phẩm</legend>
              <div className="variant-list">
                {initialProduct.variants.map((variant) => (
                  <button type="button" key={variant.id} className={`variant-option ${selected?.id === variant.id ? "is-selected" : ""}`} onClick={() => { setSelected(variant); setQuantity(1); }}>
                    <span>{variant.name}{variant.volume && variant.unit ? ` · ${variant.volume}${variant.unit}` : ""}</span>
                    <Price value={variant.price} />
                  </button>
                ))}
              </div>
            </fieldset>
          ) : <p className="form-note">Phiên bản và giá bán sẽ được cập nhật.</p>}
          {selected && <p className={outOfStock ? "stock-status stock-status--out" : "stock-status"}>
            <span aria-hidden="true">{outOfStock ? "○" : "●"}</span>{outOfStock ? "Tạm hết hàng hoặc chưa có tồn kho" : "Còn hàng"}
          </p>}
          <div className="purchase-row">
            <div className="quantity-control" aria-label="Số lượng">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Giảm số lượng">−</button>
              <input aria-label="Số lượng sản phẩm" type="number" min={1} max={available ?? 99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(Number(event.target.value) || 1, available ?? 99)))} />
              <button type="button" onClick={() => setQuantity((value) => Math.min(value + 1, available ?? 99))} aria-label="Tăng số lượng">＋</button>
            </div>
            <Button onClick={() => void add(false)} disabled={addBusy || !selected || outOfStock} className="purchase-row__add">
              {addBusy ? "Đang thêm…" : "Thêm vào giỏ"}
            </Button>
          </div>
          <Button variant="secondary" onClick={() => void add(true)} disabled={addBusy || !selected || outOfStock} className="buy-now-button">Mua ngay</Button>
          <div className="product-description">
            <h2>Thông tin sản phẩm</h2>
            {initialProduct.description
              ? <p>{initialProduct.description}</p>
              : <p>Thông tin chi tiết chính thức sẽ được chủ thương hiệu bổ sung.</p>}
          </div>
        </div>
      </section>

      <section className="section reviews-section" id="danh-gia">
        <SectionHeading eyebrow="Chia sẻ trải nghiệm" title="Đánh giá sản phẩm" description="Đánh giá được hiển thị sau khi chủ cửa hàng duyệt." />
        <div className="reviews-layout">
          <div>
            {reviewLoading ? <Loading label="Đang tải đánh giá…" />
              : reviewError ? <ErrorState message={reviewError} onRetry={() => void loadReviews()} />
                : reviews.length ? <div className="review-list">{reviews.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="review-card__heading"><Rating value={review.rating} /><time dateTime={review.created_at}>{formatDate(review.created_at)}</time></div>
                    {review.comment && <p>{review.comment}</p>}
                  </article>
                ))}</div>
                  : <EmptyState title="Chưa có đánh giá" description="Hãy là người đầu tiên chia sẻ cảm nhận sau khi trải nghiệm sản phẩm." />}
            {!reviewLoading && !reviewError && reviews.length >= 10 && (
              <button type="button" className="button button--quiet" onClick={() => setReviewPage((value) => value + 1)}>Xem thêm đánh giá</button>
            )}
          </div>
          <form className="review-form form-card" onSubmit={submitReview}>
            <h3>Gửi đánh giá</h3>
            <p>Đánh giá mới sẽ ở trạng thái chờ duyệt.</p>
            <label>Điểm đánh giá
              <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
              </select>
            </label>
            <label htmlFor="review-comment">Nhận xét <span className="optional">(không bắt buộc)</span></label>
            <textarea id="review-comment" rows={4} maxLength={10000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Chia sẻ cảm nhận của bạn…" />
            <Button type="submit" disabled={reviewBusy}>{reviewBusy ? "Đang gửi…" : user ? "Gửi đánh giá" : "Đăng nhập để đánh giá"}</Button>
          </form>
        </div>
      </section>
      {relatedError ? <p className="form-note">{relatedError}</p> : related.length > 0 && (
        <section className="section">
          <SectionHeading title="Sản phẩm liên quan" />
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}
